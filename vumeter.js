(function () {
	'use strict';
    const $this=this;
    
    // options are GetPlaybackSignalPeak and GetPlaybackSignalRms
    const getPlaybackMetric = "GetPlaybackSignalRms";
    
    const levelAsPercent = function(dBFS) {
    
        // In my setup, the I measure 85dB at my listening
        // position when playing -18dB pink noise signal at
        // a Camilla volume of -7db.
        //
        // That means that a -25dB (-7-18=-25) signal equals 85dB
        // which should match 60% on the graph, where the red bar 
        // starts. We set 0% in the graph to -80dB.
        //
        // Solving then in Wolfram Alpha for "linear (-25, 60) (-80, 0)"
        // we get the equation below
        let value = 1.09 * dBFS + 87.27
        return value < 0 ? 0 : (value > 100 ? 100 : value)
    }    

    const levelAsPercent2 = function(dBFS) {
        // https://www.moellerstudios.org/converting-amplitude-representations/
        let value = Math.pow(10, dBFS/20) * 100
        return value < 0 ? 0 : (value > 100 ? 100 : value)
    }    

    const levelAsPercent3 = function(dBFS) {
        // https://github.com/HEnquist/camillagui/blob/063abc1dcfb1386a5c5cccc97781072485b12522/src/sidepanel/vumeter.tsx#L58
        let value = 0;
        if (dBFS >= -12)
            value = 81.25 + 12.5*dBFS/6
        else if (dBFS >= -24)
            value = 68.75 + 12.5*dBFS/12
        else
            value = 56.25 + 12.5*dBFS/24
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
    let camillaState = "Unkown";
    let myVolume = -40;
    const MIN_VOLUME = -60;
    let displayState = undefined;

    let buttonState = {
        "stream": false,
        "analog": false,
        "subwoofer": false
    }

    const setDisplay = function (state) {
        return false;
        
        if (state == displayState)
            return;
        displayState = state;
        document.getElementById("dimScreen").style.display = state ? "none" : "block";
/*
        if (dspUrl) {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', dspUrl + '/?dsp-' + (state ? 'on' : 'off') + '=');
            xhr.send();
        }
*/
    }
        
    const start = function () {
        console.log("Starting socket");
        socket = new WebSocket(camillaUrl);

        // Connection opened
        socket.addEventListener('open', (event) => {
            setTimeout(function () {
                socket.send(JSON.stringify("GetConfigJson"));
                socket.send(JSON.stringify("GetState"));
                socket.send(JSON.stringify("GetVolume"));
            }, 500);
        });

       // Listen for messages
        socket.addEventListener('message', (event) => {
            console.log('Message from server ', event);
            const data = JSON.parse(event.data)

            if (data[getPlaybackMetric]) {
                checkVolume(data[getPlaybackMetric].value[0], "meterRight") 
                checkVolume(data[getPlaybackMetric].value[1], "meterLeft") 
                checkVolume(data[getPlaybackMetric].value[2], "meterSub") 
            }
            else if (data["GetVolume"]) {
                const newVolume = Math.max(data["GetVolume"].value, MIN_VOLUME);
                document.getElementById("volumeLevel").innerHTML = newVolume + "dB";
                if (newVolume != myVolume) {
                    document.getElementById("volumeControl").value = newVolume;
                    myVolume = newVolume;
                }
            }
            else if (data["GetState"]) {
                camillaState = data["GetState"].value;
            }
            else if (data["SetConfig"]) {
                // Config was changes, so we schedule an update in near future
                setTimeout(function () {
                    socket.send(JSON.stringify("GetConfigJson"));
                }, 500);
            }
            else if (data["GetConfigJson"]) {
                const config = JSON.parse(data["GetConfigJson"].value);

                // sub enabled
                buttonState['subwoofer'] = config.subState;

                // Source
                if (config.inputState == "analog") {
                    buttonState['stream'] = false;
                    buttonState['analog'] = true;
                } else {
                    buttonState['stream'] = true;
                    buttonState['analog'] = false;
                }

                fixUiButtons()
            }
        });

    }
    
    start();
	
    // every 100 msec
    // request a playback metric 
    let t0 = setInterval(function  () {
        if (socket.readyState !== WebSocket.OPEN) {
            camillaState = "Unknown"
            return;
        }

        if (camillaState == 'Running') {
            socket.send(JSON.stringify(getPlaybackMetric));
        }
    }, 100)

    // every second
    // request a status check
    let t1 = setInterval(function  () {
        setDisplay(camillaState == "Running");
        
        if (socket.readyState !== WebSocket.OPEN) {
            camillaState = "Unknown"
            return;
        }

        socket.send(JSON.stringify("GetState"));
        socket.send(JSON.stringify("GetVolume"));
    }, 1000);

    // every 5 seconds
    // restart connection if lost
    let t2 = setInterval(function  () {
        if (socket.readyState !== WebSocket.OPEN) {
            camillaState = "Unknown"
            start();
            return;
        }
        socket.send(JSON.stringify("GetConfigJson"));
    }, 5000)
    
    // Show new logo
    if (logoMsg) {
        document.getElementById("Logo").innerHTML = logoMsg;
    }
    
    // Install volume control
    const volumeControl = document.getElementById('volumeControl');
    volumeControl.addEventListener('change', function () {
        let newVolume = parseInt(volumeControl.value);
        if (newVolume == MIN_VOLUME)
            newVolume = MIN_VOLUME * 2;
        socket.send(JSON.stringify({"SetVolume": newVolume}));
    }, false);

    function fixUiButtons() {
        for (let btn of ['analog', 'stream', 'subwoofer']) {
            if (buttonState[btn])
                document.getElementById(btn).classList.add("active");
            else
                document.getElementById(btn).classList.remove("active");
        }
    }

    // Control buttons
    document.getElementById('stream').addEventListener("click", function () {
        socket.send(JSON.stringify({"SetInput" : "stream"}));
    })

    document.getElementById('analog').addEventListener("click", function () {
        socket.send(JSON.stringify({"SetInput" : "analog"}));
    })

    document.getElementById('subwoofer').addEventListener("click", function () {
        socket.send(JSON.stringify("ToggleSub"));
    })

}());