(function () {
	'use strict';
    const $this=this;
    
    // options are GetPlaybackSignalPeak and GetPlaybackSignalRms
    const getPlaybackMetric = "GetPlaybackSignalPeak";
    
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

    const getUrlParameter = function(sParam) {
        const sPageURL = window.location.search.substring(1);
        const sURLVariables = sPageURL.split('&');

        for (let i = 0; i < sURLVariables.length; i++) {
            const sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
            }
        }
        return false;
    }
    
    // Main
    let socket = null;
    let volume = 0;
    let state = "Starting";
    let volumeSet = false;
        
    const start = function () {
        console.log("Starting socket");
        socket = new WebSocket(camillaUrl);

        // Connection opened
        socket.addEventListener('open', (event) => {
            socket.send(JSON.stringify("GetVersion"));
            //socket.send(JSON.stringify({"SetUpdateInterval": 500}));
        });

       // Listen for messages
        socket.addEventListener('message', (event) => {
            //console.log('Message from server ', event.data);
            const data = JSON.parse(event.data)

            if (data[getPlaybackMetric]) {
                checkVolume(data[getPlaybackMetric].value[0], "meterRight") 
                checkVolume(data[getPlaybackMetric].value[1], "meterLeft") 
                checkVolume(data[getPlaybackMetric].value[2], "meterSub") 
            }
            else if (data["GetVolume"]) {
                volume = data["GetVolume"].value;
                document.getElementById("volumeLevel").innerHTML = volume + "dB";
                if (!volumeSet) {
                    document.getElementById("volumeControl").value = volume;
                    volumeSet = true;
                }
            }
            else if (data["GetState"]) {
                state = data["GetState"].value;
            }
        });

    }
    
    start();
	
    // every 100 msec
    // request a playback metric 
    let t0 = setInterval(function  () {
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (state == 'Running') {
            socket.send(JSON.stringify(getPlaybackMetric));
        }
    }, 100)

    // every second
    // request a status check
    let t1 = setInterval(function  () {
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }

        socket.send(JSON.stringify("GetState"));
        socket.send(JSON.stringify("GetVolume"));
    }, 1000);

    // every 5 seconds
    // restart connection if lost
    let t2 = setInterval(function  () {
        if (socket.readyState !== WebSocket.OPEN) {
            start();
        }
    }, 5000)
    
    // Show new logo
    if (logoMsg) {
        document.getElementById("Logo").innerHTML = logoMsg;
    }
    
    // Install volume control
    const volumeControl = document.getElementById('volumeControl')
    volumeControl.addEventListener('change', function () {
        let newVolume = volumeControl.value;
        console.log("new volume should be " + newVolume)
        socket.send(JSON.stringify({"SetVolume": parseInt(newVolume)}));
        volumeSet = false;
        socket.send(JSON.stringify("GetVolume"));
    }, false);

}());