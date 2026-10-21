/*
  In-module definitions of the WASI and Emscripten functions that libc and libc++ reach for.

  The linker only turns these into imports when nothing defines them, so defining them here
  leaves the module with an empty import table. None of them do anything useful, on purpose:
  the engine is driven through `analyse` and never needs a terminal, files, environment or a
  clock. Output is swallowed, input is always at end of file, and anything that wants to exit
  traps instead, which the host already treats as a failed call.
*/

#include <stdint.h>

typedef uint16_t wasi_errno;

enum { WASI_ESUCCESS = 0, WASI_EBADF = 8, WASI_ESPIPE = 70 };

struct wasi_ciovec {
    const uint8_t* buf;
    uint32_t       len;
};

/* Writes to stdout and stderr succeed and go nowhere. */
wasi_errno __wasi_fd_write(int32_t fd, const struct wasi_ciovec* iovs, int32_t iovs_len, uint32_t* nwritten) {
    (void) fd;
    uint32_t total = 0;
    for (int32_t i = 0; i < iovs_len; ++i)
        total += iovs[i].len;
    *nwritten = total;
    return WASI_ESUCCESS;
}

/* Reads see end of file straight away. */
wasi_errno __wasi_fd_read(int32_t fd, const struct wasi_ciovec* iovs, int32_t iovs_len, uint32_t* nread) {
    (void) fd; (void) iovs; (void) iovs_len;
    *nread = 0;
    return WASI_ESUCCESS;
}

/* The standard streams are not seekable, as on a pipe. */
wasi_errno __wasi_fd_seek(int32_t fd, int64_t offset, int32_t whence, uint64_t* newoffset) {
    (void) fd; (void) offset; (void) whence; (void) newoffset;
    return WASI_ESPIPE;
}

/* There are no open files to close. */
wasi_errno __wasi_fd_close(int32_t fd) {
    (void) fd;
    return WASI_EBADF;
}

/* An empty environment. */
wasi_errno __wasi_environ_sizes_get(uint32_t* count, uint32_t* buf_size) {
    *count    = 0;
    *buf_size = 0;
    return WASI_ESUCCESS;
}

wasi_errno __wasi_environ_get(uint8_t** environ, uint8_t* buf) {
    (void) environ; (void) buf;
    return WASI_ESUCCESS;
}

/* exit(), _Exit() and abort() end the call with a trap rather than asking the host to exit. */
_Noreturn void __wasi_proc_exit(int32_t code) {
    (void) code;
    __builtin_trap();
}

/* Emscripten tells the embedder after memory.grow so JS can refresh its views. Nobody is listening. */
void emscripten_notify_memory_growth(int32_t memory_index) {
    (void) memory_index;
}
