"""Reports only whether a needle appears in a process's argv/env block (macOS kern.procargs2). Never prints content."""
import ctypes, ctypes.util, sys
pid, needle = int(sys.argv[1]), sys.argv[2].encode()
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
mib = (ctypes.c_int * 3)(1, 49, pid)  # CTL_KERN, KERN_PROCARGS2, pid
size = ctypes.c_size_t(0)
if libc.sysctl(mib, 3, None, ctypes.byref(size), None, 0) != 0:
    print(f"read failed errno={ctypes.get_errno()}"); sys.exit(0)
buf = ctypes.create_string_buffer(size.value)
if libc.sysctl(mib, 3, buf, ctypes.byref(size), None, 0) != 0:
    print(f"read failed errno={ctypes.get_errno()}"); sys.exit(0)
data = buf.raw[: size.value]
print(f"read ok; bytes={len(data)}; needle present={needle in data}")
