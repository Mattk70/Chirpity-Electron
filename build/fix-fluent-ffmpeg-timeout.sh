#!/usr/bin/bash

sed -i -e '/^\s*setTimeout(function() {/,/}, 20);/c\
        setTimeout(function() {\
            if (ffmpegProc.exitCode === null) {\
                emitEnd(new Error('\''Output stream closed'\''));\
                ffmpegProc.kill();\
            }\
        }, 5000);' ./node_modules/fluent-ffmpeg/lib/processor.js


PLATFORM='win32-x64'
BINARY='ffmpeg.exe'

echo "copying  ./build/$PLATFORM/$BINARY to ./node_modules/@ffmpeg-installer/$PLATFORM/$BINARY"
cp ./build/$PLATFORM/$BINARY ./node_modules/@ffmpeg-installer/$PLATFORM/$BINARY