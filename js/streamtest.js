const fs = require('fs'),
    es = require('event-stream')

const s = fs
    .createReadStream(filePath)
    .pipe(es.Stream)
    .pipe(
        es
            .mapSync(function(line){

            })
            .on('error', function(err){
                console.log("Error reading file.", err)
            })
            .on('end', function(){
                console.log("Done reading file")
            })
    )
