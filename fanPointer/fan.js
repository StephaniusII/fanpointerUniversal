/*
This script is used to move and turn a Fan image and control a cursor image. The new cursor can interact with elements of the class "target" on the page.

Author: Stephan Burn
Date: 19.04.2025

Some elements were created with the help of Microsoft Copilot.
*/

const cursorVelocity    =   {vel:   0.0,     velX:  0.0,  velY:  0.0};
const accelerationXY    =   {x:     0.0,     y:     0.0};
const relPos            =   {distance: 0.0, angle: 0.0, angleOffset: 0.0};

//Contains elements that are clickable or hoverable.
let elements = new Set();

//size of playarea
var screensize          =   null;
let fanSpeed = 0.1;

let fanAngle            =   0.0;
let clickOccured        =   false;

let debugging          =   false;

let fanEnabled          =   false;

let initialized = false;

const scriptDirectory = new URL(document.currentScript.src).pathname.split('/').slice(0, -1).join('/');

document.addEventListener("DOMContentLoaded", () => {
    initFan();
});


function initFan(){

    window.addEventListener("resize", updateScreenSize);
    updateScreenSize();
    addEventListener("mousemove", moveFan, { passive: false});
    addEventListener("wheel", turnFan, { passive: false});    
    addEventListener("click", clicked, {passive: false});
    addEventListener("dragstart", (e) => e.preventDefault(), {passive: false});
    addEventListener("dragover", (e) => e.preventDefault(), {passive: false});

    //add the fan styles css to the head of the document
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "./fanpointer/stylesFan.css"; // Replace with your stylesheet URL
    document.head.appendChild(link);

    //append the HTML elements for the fanPointer to the body
    const container = document.createElement("div");
    container.id = "fanContainer";
    container.classList.add("fanstuff");

    container.innerHTML = `
        <div id="cursorDiv">
            <img id="cursor" src="${scriptDirectory}/images/cursor.webp" alt="">
            <svg class="fsvg" id="pointerSVG">
                <circle id="pointer" r="4px" cx="4px" cy="4px"></circle>
            </svg>
        </div>
        <div id="fanpointer">
            <img id="fan" src="${scriptDirectory}/images/fancursor.webp" alt="">
            <img id="airflow" src="${scriptDirectory}/images/airflow.svg" alt="">
        </div>
        <div id="debuggingView"> 
            <span id="posSpan"></span>
            <img id="crosshair1" class="crosshair" src="${scriptDirectory}/images//crosshair.svg" height="50px" alt="">
            <img id="crosshair2" class="crosshair" src="${scriptDirectory}/images//crosshair.svg" height="50px" alt="">
            <svg class="fsvg">
                <line id="accelerationVector" x1="0px" x2="20px" y1="0px" y2="20px" stroke="red" fill="none" stroke-width="4"></line>
                <line id="speedVector" x1="0px" x2="20px" y1="0px" y2="20px" stroke="blue" fill="none" stroke-width="2"></line>
                <line id="fanVector" x1="0px" x2="20px" y1="0px" y2="20px" stroke="blue" fill="none" stroke-width="2"></line>
            </svg>
        </div>
    `;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(container);
    document.body.appendChild(fragment);    

    //loads and adds script and event listeners for touchInput
    loadScript(`${scriptDirectory}/touchInputHandler.js`);

    // get clickable elements
    document.querySelectorAll('a, button, input, [onclick], [role="button"], [tabindex]').forEach(element => elements.add(element));

    //copy each :hover class to a .hover class.
    //this is needed because the :hover class does not work with the fanPointer
    //Thanks microsoft copilot for this one.
    for (let sheet of document.styleSheets) {
        try {
            // Skip stylesFan.css
            if (sheet.href && sheet.href.includes("stylesFan.css")) {
                continue; 
            }
    
            // Check if the stylesheet can be accessed
            if (!sheet.cssRules) {
                console.warn(`Cannot access rules for ${sheet.href}`);
                continue;
            }
    
            for (let rule of sheet.cssRules) {
                if (rule.selectorText && rule.selectorText.includes(":hover")) {
                    let newSelector = rule.selectorText.replace(":hover", ".hover");
                    let newRule = `${newSelector} { ${rule.style.cssText} }`;
                    sheet.insertRule(newRule, sheet.cssRules.length);
                    console.log("Added rule:", newRule);
    
                    let baseSelector = rule.selectorText.replace(":hover", "").trim();
                    try {
                        const foundElements = document.querySelectorAll(baseSelector);
                        foundElements.forEach(element => elements.add(element));
                    } catch (err) {
                        console.warn("Invalid selector:", baseSelector);
                    }
                }
            }
        } catch (e) {
            console.warn(`Skipping stylesheet due to CORS restrictions: ${sheet.href}`);
        }
    }

    if (debugging){
        console.log("All interactive elements:", elements);
    }

    //add an id to each element that doesn't have one
    const elementsArray = Array.from(elements); // Convert Set to Array
    let idAdded = [];
    for (let i = 0; i < elementsArray.length; i++) {
        if (!elementsArray[i].id) {
            elementsArray[i].id = `auto-id-${i}`;
            idAdded.push(elementsArray[i]);
        }
        console.log("Added ID to element:", elementsArray[i]);
    }

    //add a mutation observer to the document body to detect added or removed elements
    //next step: check new node and child nodes for clickable and hoverable elements
    //and add them to the elements set.
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Ensures it's an element (not text)
                    console.log("New element added:", node);
                }
            });
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1) { // Ensures it's an element (not text)
                    console.log("Element removed:", node);
                }
            });
        });
    });
    
    // Start observing the `document.body` for added elements
    observer.observe(document.body, { childList: true, subtree: true });
    
    initialized = true;
    //take the previous state of the fan from the sessionStorage
    sessionStorage.getItem("isEnabled") === "true" ? enableFan() : disableFan();
}

function toggleFan() { //enables and disables the events and animations of the fan script.
    if (!fanEnabled) {
        enableFan();
    } else {
        disableFan();
    }
}

function enableFan(){
    if (!initialized){
        initFan();
    }
    fanContainer.classList.add("expanded");
    updateScreenSize();

    setTimeout(() => {
        fanEnabled = true;
        requestAnimationFrame(update);
    }, 210);    //delayed to prevent clicking on the first frame.
                //animation frame is not triggered again if fanEnabled is false.

    console.log("Fan enabled");

    //save mouse mode to sessionStorage
    sessionStorage.setItem("isEnabled", true);

};

function disableFan(){
    fanEnabled = false;
    setTimeout(() => {
        elements.forEach((element) => {
            element.classList.remove("clicked")
            element.classList.remove("hover")
        });
    }, 200);
    fanContainer.classList.remove("expanded");
    console.log("Fan disabled");

    //save mouse mode to sessionStorage
    sessionStorage.setItem("isEnabled", false);

}

function loadScript(url) {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    document.head.appendChild(script);
}

function updateScreenSize() {
    screensize = {right: window.innerWidth, bottom: window.innerHeight, top: 0, left: 0 };
    if (screensize.width < 786) {
        fanSpeed = 0.05;
    } else {
        fanSpeed = 0.1;
    }
}

function clicked(){
    if (fanEnabled){
        clickOccured = true;
        setTimeout(() => {
            clickOccured = false;
        }, 200);
    }
}

function moveFan(e){
    if (fanEnabled){
        let fanY = e.clientY;
        let fanX = e.clientX;
        fanpointer.style.top=fanY+"px";
        fanpointer.style.left=fanX+"px";
    }
}

function turnFan(e){
    if (fanEnabled){
        e.preventDefault();
        fanAngle=(fanAngle+e.deltaY/300)%(2*Math.PI);
        if (fanAngle < 0){
            fanAngle = 2*Math.PI + fanAngle;
        }

        fanpointer.style.transform = `rotate(${fanAngle}rad)`;
    }
}

function turnFanTouch(angleDiff){
    if (fanEnabled){
        fanAngle=(fanAngleStart+angleDiff*1.5)%(2*Math.PI);
        if (fanAngle < 0){
            fanAngle = 2*Math.PI + fanAngle;
        }

        fanpointer.style.transform = `rotate(${fanAngle}rad)`;
    }
}

function getRelPos(){
    const fanBox = fanpointer.getBoundingClientRect();
    const cursorPos = cursorDiv.getBoundingClientRect();

    let relXY = {   x: fanBox.x + fanBox.width/2 - cursorPos.x,
                    y: fanBox.y + fanBox.height/2 - cursorPos.y
                };
    
    relPos.distance = Math.sqrt(Math.pow(relXY.x, 2) + Math.pow(relXY.y, 2));

    let angle = Math.atan2(relXY.y,relXY.x)+Math.PI;
    if (angle < 0){
        angle = 2*Math.PI + angle;
    }

    relPos.angle = angle;


    let angleOffset = Math.abs(fanAngle-angle)%(2*Math.PI);
    if (angleOffset > Math.PI){
        angleOffset = 2 * Math.PI - angleOffset;
    }

    relPos.angleOffset = angleOffset
}

function accelerateCursor(deltaTime){

    //calculate acceleration according to distance and angle offset
    let acceleration = fanSpeed * Math.max(((200-relPos.distance)/200)-(relPos.angleOffset)/2,0)*deltaTime;
    
    //calculate acceleration per axis
    accelerationXY.x = Math.cos(relPos.angle)*acceleration;
    accelerationXY.y = Math.sin(relPos.angle)*acceleration;

    cursorVelocity.velX += accelerationXY.x;
    cursorVelocity.velY += accelerationXY.y;
}

function decelerateCursor(deltaTime){
    let dampingFactor = 0.3;
    // Apply damping
    cursorVelocity.velX *= Math.pow(dampingFactor, deltaTime / 1000);
    cursorVelocity.velY *= Math.pow(dampingFactor, deltaTime / 1000);

    // If velocity gets very small, stop it completely
    if (Math.abs(cursorVelocity.velX) < 0.01) {
        cursorVelocity.velX = 0;
    }

    if (Math.abs(cursorVelocity.velY) < 0.01) {
        cursorVelocity.velY = 0;
    }

    cursorVelocity.vel = Math.sqrt(Math.pow(cursorVelocity.velX, 2) + Math.pow(cursorVelocity.velY, 2));
}

function moveCursor() {
    const cursorDivBox = cursorDiv.getBoundingClientRect();

    // Calculate new positions
    let newTop = cursorDivBox.top + cursorVelocity.velY;
    let newLeft = cursorDivBox.left + cursorVelocity.velX;

    const cursorBox = document.getElementById("cursor").getBoundingClientRect();

    // Check for collisions with the vertical borders (top and bottom)
    if (newTop < screensize.top + cursorBox.height/2 || 
        newTop + cursorBox.height/2 > screensize.bottom) {
        cursorVelocity.velY *= -0.5; // Reverse and dampen the Y velocity
        newTop = cursorDivBox.top + cursorVelocity.velY*2; // Recalculate newTop after bouncing
        if (debugging){
            console.log("bounceY");
        }
    }

    // Check for collisions with the horizontal borders (left and right)
    if (newLeft < screensize.left + cursorBox.width/2|| 
        newLeft + cursorBox.width/2 > screensize.right) {
        cursorVelocity.velX *= -0.5; // Reverse and dampen the X velocity

        newLeft = cursorDivBox.left + cursorVelocity.velX*2; // Recalculate newLeft after bouncing

        if (debugging){
            console.log("bounceX");
        }
    }

    // Apply the new position to the cursor element
    cursorDiv.style.top = newTop + "px";
    cursorDiv.style.left = newLeft + "px";
}

function isPointerOnObject(pointerId, objectId) {
    const pointer = document.getElementById(pointerId);
    const objectElem = document.getElementById(objectId);

    const pointerBox = pointer.getBoundingClientRect();
    const objectBox = objectElem.getBoundingClientRect();

    // Check if pointer coordinates are within the object's bounding box
    const isOnObject =
        pointerBox.left < objectBox.right &&
        pointerBox.right > objectBox.left &&
        pointerBox.top < objectBox.bottom &&
        pointerBox.bottom > objectBox.top;

    return isOnObject;
}

function scrollToPosition(objectId) {
    const element = document.getElementById(objectId);

    if (element) {
        // Get page dimensions
        const pageHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;

        const pageWidth = document.documentElement.scrollWidth;
        const viewportWidth = window.innerWidth;

        const maxScrollDistanceY = pageHeight - viewportHeight; // Vertical max scroll
        const maxScrollDistanceX = pageWidth - viewportWidth;  // Horizontal max scroll

        const scrollX = maxScrollDistanceX * ((element.offsetLeft - element.offsetWidth) / viewportWidth);
        const scrollY = maxScrollDistanceY * ((element.offsetTop-element.style.height)/viewportHeight);

        const scrollPos = {
            y: scrollY,
            x: scrollX
        };


        window.scrollTo({
            top: scrollPos.y,
            left: scrollPos.x,
            behavior: 'instant',
        });
    }
}

function toggleDebugger(){
    const debbuggingViewElem = document.getElementById("debuggingView");
    if (debugging) {
        debugging = false;
        debbuggingViewElem.style.display = "none";
        document.getElementById("pointer").style.fill = "none" 
    } else {
        debugging = true;
        debbuggingViewElem.style.display = "block";
        document.getElementById("pointer").style.fill = "red" 
        crosshair1.height = "50px";
        crosshair2.height = "50px";
    }
};

function showValues(){
    const posSpan = document.getElementById("posSpan");
    posSpan.innerHTML = `Distance: ${Math.floor(relPos.distance)} <br> Relative Angle: ${relPos.angle.toFixed(2)}<br> Angle Offset: "${relPos.angleOffset.toFixed(2)}<br> Velocity: ${cursorVelocity.vel.toFixed(2)}`;

    const speedVectorElem = document.getElementById("speedVector");
    speedVectorElem.x1.baseVal.value = cursorDiv.getBoundingClientRect().x;
    speedVectorElem.y1.baseVal.value = cursorDiv.getBoundingClientRect().y;
    speedVectorElem.x2.baseVal.value = cursorVelocity.velX*10 + cursorDiv.getBoundingClientRect().x;
    speedVectorElem.y2.baseVal.value = cursorVelocity.velY*10 + cursorDiv.getBoundingClientRect().y;

    const accelerationVectorElem = document.getElementById("accelerationVector");
    accelerationVectorElem.x1.baseVal.value = cursorDiv.getBoundingClientRect().x;
    accelerationVectorElem.y1.baseVal.value = cursorDiv.getBoundingClientRect().y;
    accelerationVectorElem.x2.baseVal.value = accelerationXY.x*50 + cursorDiv.getBoundingClientRect().x;
    accelerationVectorElem.y2.baseVal.value = accelerationXY.y*50 + cursorDiv.getBoundingClientRect().y;

    const fanVectorElem = document.getElementById("fanVector");
    const fanBox = fanpointer.getBoundingClientRect();
    const fanPosX = fanBox.x;
    const fanPosY = fanBox.y;
    fanVectorElem.x1.baseVal.value = fanPosX;
    fanVectorElem.y1.baseVal.value = fanPosY;
    fanVectorElem.x2.baseVal.value = Math.cos(fanAngle)*100+fanPosX;
    fanVectorElem.y2.baseVal.value = Math.sin(fanAngle)*100+fanPosY;


    const crosshair1Elem = document.getElementById("crosshair1").style;
    crosshair1Elem.top=cursorDiv.getBoundingClientRect().y+"px";
    crosshair1Elem.left=cursorDiv.getBoundingClientRect().x+"px";

    const crosshair2Elem = document.getElementById("crosshair2").style;
    crosshair2Elem.top=(fanPosY)+"px";
    crosshair2Elem.left=(fanPosX)+"px";
}

function checkInteraction(elementsSet){
    elementsSet.forEach((element) => {
        try {
            if (isPointerOnObject("pointer", element.id)) {
                element.classList.add("hover")
                if (clickOccured){
                    element.classList.add("clicked")

                    //makes sure that the element is clicked even if it is an SVG element
                    //and has an onclick attribute. This is needed for the fanPointer to work with SVG elements
                    if (element instanceof SVGElement && element.hasAttribute("onclick")) {
                        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                    } else { element.click(); }

                    clickOccured = false;
                    setTimeout(() => {
                        element.classList.remove("clicked");
                    }, 200);
                } else {
                    element.classList.remove("clicked")
                }
            } else {
                element.classList.remove("hover")
            }
        } catch (error) {
            console.error("Error processing element with ID:", element.id, error);
        }

    });
}

let lastTime = null;
function update(time) {
    if (fanEnabled) {
        requestAnimationFrame(update);
    }

  if (!lastTime) {
    lastTime = time;
    return;
  }
  const deltaTime = time - lastTime;
  lastTime = time;

    getRelPos();        
    accelerateCursor(deltaTime);
    decelerateCursor(deltaTime);
    moveCursor();

    scrollToPosition('cursorDiv');

    checkInteraction(elements);

    if (debugging){
        showValues()
    }
}




