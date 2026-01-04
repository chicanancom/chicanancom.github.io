export let audioContext;
export let analyser;
export let dataArray;
let source;

export async function setupAudio(sourceInput) {
    if (audioContext) {
        audioContext.close();
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    let arrayBuffer;

    if (typeof sourceInput === 'string') {
        const response = await fetch(sourceInput);
        arrayBuffer = await response.arrayBuffer();
    } else {
        const fileReader = new FileReader();
        arrayBuffer = await new Promise((resolve, reject) => {
            fileReader.onload = (e) => resolve(e.target.result);
            fileReader.onerror = (e) => reject(e);
            fileReader.readAsArrayBuffer(sourceInput);
        });
    }

    const buffer = await audioContext.decodeAudioData(arrayBuffer);

    if (source) source.disconnect();

    source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    source.start(0);
    return { audioContext, analyser, dataArray };
}

export function getAudioData() {
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }
    return null;
}

