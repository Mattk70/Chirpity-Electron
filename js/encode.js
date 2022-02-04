import fs from "fs";

const init = {
    output: handleOutput,
    error: (e) => {
        console.log(e.message);
    }
};

let config = {
    codec: 'mp3',
    bitrate: 192_000, // 192kbps
};

let encoder = new AudioEncoder(init);
encoder.configure(config);

async function exportMP3(data){
    encoder.encode(data)
}


function handleOutput() {
    fs.writeFile('text.mp3',
        str, function (err) {
            if (err) throw err;
            console.log('Saved!');
        });
}