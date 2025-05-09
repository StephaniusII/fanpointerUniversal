/* Try one to create a multi-touch input handler. Goal is to implement this in the fan pointer script.
author: Stephan Burn
date: 05.05.2025
*/

var touches = [];
let angleStart = 0.0;
let fanAngleStart = 0.0;
let distanceStart = 0.0;
let angle = 0.0;
let distance = 0.0;
let touchTimeStart = Date.now();

function touchstart(event) {
    if (fanEnabled) {
        event.preventDefault();
        var touches = event.touches;
        touchTimeStart = Date.now();
        for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];
            var x = touch.clientX;
            var y = touch.clientY;
            // Handle the touch event here
        }
        moveFan(touches[0]);
        if (touches.length == 2){
            angleStart = Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX);
            fanAngleStart = fanAngle;
            distanceStart = Math.sqrt(Math.pow(touches[1].clientX - touches[0].clientX, 2) + Math.pow(touches[1].clientY - touches[0].clientY, 2));
        }
    }
}

function touchmove(event) {   
    if (fanEnabled) { 
        event.preventDefault();
        touches = event.touches;
        for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];
            var x = touch.clientX;
            var y = touch.clientY;
        }
        if (touches.length == 2){
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const x1 = touch1.clientX;
            const y1 = touch1.clientY;
            const x2 = touch2.clientX;
            const y2 = touch2.clientY;
            distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            angle = Math.atan2(y2 - y1, x2 - x1);
            const angleDiff = angle - angleStart;
            const distanceDiff = distance - distanceStart;
            turnFanTouch(angleDiff);
        }

        moveFan(touches[0]);
    }
}

function touchend(event) {
    if (fanEnabled) {
        event.preventDefault();
        touches = event.touches;
        let touchTime = Date.now() - touchTimeStart;
        if (touchTime < 100) {
            clicked();
        } else {
            //long press: 
            // make sure to prevent trigger when finger moved
        }

    }

}

function getTouchByID(id) {
    for (var i = 0; i < touches.length; i++) {
        if (touches[i].identifier == id) {
            return touches[i];
        }
    }
    return null;
}

addEventListener("touchstart", touchstart, { passive: false});
addEventListener("touchmove", touchmove, { passive: false});
addEventListener("touchend", touchend, { passive: false});
