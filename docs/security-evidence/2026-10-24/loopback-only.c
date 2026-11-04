#define _GNU_SOURCE
#include <sys/socket.h>
#include <netinet/in.h>
#include <netdb.h>
#include <dlfcn.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
/* Extra process-level egress guard for trusted dynamic Node/Java executables.
 * Not a kernel sandbox and not intended to confine malicious code. */
static int allowed(const struct sockaddr *a, socklen_t n) {
 if (!a) return 1;
 if (a->sa_family==AF_UNIX) return 1;
 if (a->sa_family==AF_INET && n>=sizeof(struct sockaddr_in))
  return ((const struct sockaddr_in*)a)->sin_addr.s_addr==htonl(0x7f000001);
 if (a->sa_family==AF_INET6 && n>=sizeof(struct sockaddr_in6)) {
  const struct in6_addr *ip=&((const struct sockaddr_in6*)a)->sin6_addr;
  if (IN6_IS_ADDR_LOOPBACK(ip)) return 1;
  return IN6_IS_ADDR_V4MAPPED(ip) && ip->s6_addr[12]==127 && ip->s6_addr[13]==0 && ip->s6_addr[14]==0 && ip->s6_addr[15]==1;
 }
 return 0;
}
static int denied(void) { fputs("LOOPBACK_GUARD: blocked non-loopback network operation\n",stderr);errno=EPERM;return -1; }
int connect(int fd,const struct sockaddr *a,socklen_t n) {
 if(!allowed(a,n))return denied();
 int(*fn)(int,const struct sockaddr*,socklen_t)=dlsym(RTLD_NEXT,"connect");return fn(fd,a,n);
}
ssize_t sendto(int fd,const void *b,size_t len,int flags,const struct sockaddr *a,socklen_t n) {
 if(!allowed(a,n))return denied();
 ssize_t(*fn)(int,const void*,size_t,int,const struct sockaddr*,socklen_t)=dlsym(RTLD_NEXT,"sendto");return fn(fd,b,len,flags,a,n);
}
ssize_t sendmsg(int fd,const struct msghdr *m,int flags) {
 if(!allowed(m->msg_name,m->msg_namelen))return denied();
 ssize_t(*fn)(int,const struct msghdr*,int)=dlsym(RTLD_NEXT,"sendmsg");return fn(fd,m,flags);
}
int sendmmsg(int fd,struct mmsghdr *m,unsigned n,int flags) {
 for(unsigned i=0;i<n;i++)if(!allowed(m[i].msg_hdr.msg_name,m[i].msg_hdr.msg_namelen))return denied();
 int(*fn)(int,struct mmsghdr*,unsigned,int)=dlsym(RTLD_NEXT,"sendmmsg");return fn(fd,m,n,flags);
}
int getaddrinfo(const char *node,const char *service,const struct addrinfo *h,struct addrinfo **r) {
 if(node && strcmp(node,"localhost") && strcmp(node,"127.0.0.1") && strcmp(node,"::1")) {
  fputs("LOOPBACK_GUARD: blocked non-loopback name resolution\n",stderr);return EAI_NONAME;
 }
 int(*fn)(const char*,const char*,const struct addrinfo*,struct addrinfo**)=dlsym(RTLD_NEXT,"getaddrinfo");return fn(node,service,h,r);
}
