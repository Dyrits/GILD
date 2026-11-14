"""Finds a process by an argv marker via libproc enumeration; prints only yes/no and counts, never content."""
import ctypes, ctypes.util, os, sys
marker = sys.argv[1].encode()
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
n = libc.proc_listpids(1, 0, None, 0)  # PROC_ALL_PIDS
arr = (ctypes.c_int * (n // 4 + 64))()
got = libc.proc_listpids(1, 0, arr, ctypes.sizeof(arr)) // 4
pids = [p for p in arr[:got] if p > 0]
def argsof(pid):
    mib = (ctypes.c_int * 3)(1, 49, pid); size = ctypes.c_size_t(0)
    if libc.sysctl(mib, 3, None, ctypes.byref(size), None, 0) != 0: return b""
    buf = ctypes.create_string_buffer(size.value)
    if libc.sysctl(mib, 3, buf, ctypes.byref(size), None, 0) != 0: return b""
    return buf.raw[: size.value]
hits = [p for p in pids if p != os.getpid() and marker in argsof(p)]
print(f"enumerated {len(pids)} pids; processes whose argv/env hold the marker: {len(hits)}")
