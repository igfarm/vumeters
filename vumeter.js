(function () {
	'use strict';
    const $this=this;
    
    const playbackMetric = "GetPlaybackSignalRms";


    const levelAsPercent = function(dBFS) {
        let value = 0;
        if (dBFS >= -12)
            value = 81.25 + 12.5*dBFS/6
        else if (dBFS >= -24)
            value = 68.75 + 12.5*dBFS/12
        else
            value = 56.25 + 12.5*dBFS/24

        return value < 0 ? 0 : (value > 100 ? 100 : value)
    }    

    const levelAsPercent2 = function(dBFS) {
        // https://www.moellerstudios.org/converting-amplitude-representations/
        let value = Math.pow(10, dBFS/20) * 100
        return value < 0 ? 0 : (value > 100 ? 100 : value)
    }    

    const checkVolume = function(volume, meter){

        //min=20deg   max=160deg
        let rotation = 1.4 * levelAsPercent(volume) + 20;
        if (rotation < 20)
            rotation = 20;
        else if (rotation > 160)
            rotation = 160;

        let needles = document.getElementById(meter).getElementsByClassName('needle');
        let needle=needles[0];
        
        needle.style.transform="rotate("+rotation+"deg)";
    }

	let socket = new WebSocket(camillaUrl);
    
    // Connection opened
    socket.addEventListener('open', (event) => {
        socket.send(JSON.stringify("GetVersion"));
        //socket.send(JSON.stringify({"SetUpdateInterval": 500}));

        let t = setInterval(function  () {
            socket.send(JSON.stringify(playbackMetric));
        }, 100)
    });

   // Listen for messages
    socket.addEventListener('message', (event) => {
        //console.log('Message from server ', event.data);
        const data = JSON.parse(event.data)
        if (data[playbackMetric]) {
            checkVolume(data[playbackMetric].value[0], "meterRight") 
            checkVolume(data[playbackMetric].value[1], "meterLeft") 
            checkVolume(data[playbackMetric].value[2], "meterSub") 
        }
    });
}());