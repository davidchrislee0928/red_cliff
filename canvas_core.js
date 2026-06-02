/**
 * 🧱 canvas_core.js - 核心数据生命周期、全局拦截器与时序大循环时钟（Windows 本地 Fetch 起跑熔断版）
 */

window.onerror = function(message, source, lineno, colno, error) {
    console.error(`🚨 [Fatal Error Trace] 发现崩溃：${message} | 来源: ${source} | 行号: ${lineno}:${colno}`);
    return false;
};

window.localParams = null;
let ship = null; 
let riverParticles = [];
let isExploded = false;
let simTime = 0;
let isRecordLogged = false; 

let showHumanForce = true;
let showSailForce = true;
let showWaterForce = true;

const BTN_Y = 675;
const BTN_W = 125;
const BTN_H = 22;
const BTN1_X = 25; const BTN2_X = 165; const BTN3_X = 305;

let k_sailHeight = 1.0;
let k_sailAngle = 25;
let k_rudderAngle = -20;

const KEY_UI = {
    w: {x: 95, y: 340, w: 50, h: 50, label: "W\n升帆"},
    a: {x: 35, y: 400, w: 50, h: 50, label: "A\n左舵"},
    s: {x: 95, y: 400, w: 50, h: 50, label: "S\n降帆"},
    d: {x: 155, y: 400, w: 50, h: 50, label: "D\n右舵"},
    left: {x: 35, y: 465, w: 80, h: 35, label: "◀ 帆左调"},
    right: {x: 125, y: 465, w: 80, h: 35, label: "帆右调 ▶"}
};

function setup() {
    createCanvas(900, 1820); 
    frameRate(60); 
    
    if (sessionStorage.getItem("chibi_show_human") !== null) showHumanForce = sessionStorage.getItem("chibi_show_human") === "true";
    if (sessionStorage.getItem("chibi_show_sail") !== null) showSailForce = sessionStorage.getItem("chibi_show_sail") === "true";
    if (sessionStorage.getItem("chibi_show_water") !== null) showWaterForce = sessionStorage.getItem("chibi_show_water") === "true";

    if (sessionStorage.getItem("k_sail_height") !== null) k_sailHeight = parseFloat(sessionStorage.getItem("k_sail_height"));
    if (sessionStorage.getItem("k_sail_angle") !== null) k_sailAngle = parseFloat(sessionStorage.getItem("k_sail_angle"));
    if (sessionStorage.getItem("k_rudder_angle") !== null) k_rudderAngle = parseFloat(sessionStorage.getItem("k_rudder_angle"));

    riverParticles = [];
    for(let i = 0; i < 150; i++) {
        riverParticles.push(new RiverParticle());
    }

    if (window.onChibiSetupExt) {
        window.onChibiSetupExt();
    }
}

function draw() {
    let p = window.localParams;
    if (!p) {
        p = {
            "w_river": 2000, "v_river": 1.2, "v_wind": 14.0, "u_human": 25,
            "keel_mass": 0, "keel_depth": 0.0, "keel_idx": 0,
            "sail_mass": 1500, "sail_area": 120, "sail_eff": 0.45, "sail_idx": 0,
            "reset_trigger": false, "run_trigger": false
        };
    }

    handleKeyboardAndMouseControls();
    p.sail_height = k_sailHeight; p.sail = k_sailAngle; p.rudder = k_rudderAngle; p.sail_raised = (k_sailHeight > 0);

    // 战船保底实例化
    if (p.reset_trigger || !ship) {
        ship = new window.WarShip(2400, 0); simTime = 0; isExploded = false; isRecordLogged = false;
        sessionStorage.setItem("chibi_sim_time", 0); sessionStorage.setItem("chibi_exploded", "false");
        saveStateToStorage(2400, 0, 0, 0, radians(135));
    }

    if (window.onChibiEquipExt) {
        window.onChibiEquipExt(ship, p);
    }

    // 🌟【起跑分步控制器】：一进来 p.run_trigger 是 false，画面纯精致静态渲染，100% 拒绝任何加载卡死死机！
    // 只有当点击控制台的“开始推演”按钮后，由于起跑状态拉起，才真正激活 30 倍速物理狂飙！
    if (p.run_trigger && !isExploded) {
        ship.applyTruePhysics(p); 
        
        let timeStepMultiplier = 1;
        ship.update((1 / 60) * timeStepMultiplier); 
        
        saveStateToStorage(ship.pos.x, ship.pos.y, ship.vel.x, ship.vel.y, ship.heading);
        
        if (ship.pos.y >= p.w_river) { 
            isExploded = true; 
            sessionStorage.setItem("chibi_exploded", "true"); 
        }
    }

    // 🎯 核心改变：利用 Fetch 异步直通车回传。撞线瞬间将数据直接注入后台嵌入式 Flask 端口
    if (isExploded && !isRecordLogged && simTime > 0.5) {
        isRecordLogged = true;
        let finalTimeStr = simTime.toFixed(2);
        
        let k_names = ["传统平底无龙骨沙船", "汉代半通材重木短龙骨", "突厥式硬木深尖龙骨"];
        let s_names = ["汉代编织篾席硬帆", "古典罗马多层方帆", "阿拉伯高气动三角帆"];
        let currentConfigStr = k_names[p.keel_idx] + " + " + s_names[p.sail_idx];

        console.log("⚓ 战船撞线成功！Fetch 异步秒射本地网关存储...", finalTimeStr);
        
        fetch('http://127.0.0.1:8055/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                time_used: finalTimeStr,
                config: currentConfigStr
            })
        })
        .then(res => res.json())
        .then(data => console.log("🚀 [Database OK] SQLite3 数据持久化成功！", data))
        .catch(err => console.error("🚨 本地网关写入失败: ", err));
    }

    if (window.onChibiRenderExt) {
        window.onChibiRenderExt(p, ship, simTime, isExploded, riverParticles);
    }
    
    if (p.run_trigger && !isExploded) { simTime += (1 / 60) ; } 
}

function handleKeyboardAndMouseControls() {
    let isW = keyIsDown(87) || keyIsDown(119); let isA = keyIsDown(65) || keyIsDown(97);
    let isS = keyIsDown(83) || keyIsDown(115); let isD = keyIsDown(68) || keyIsDown(100);
    let isLeft = keyIsDown(LEFT_ARROW); let isRight = keyIsDown(RIGHT_ARROW);

    if (mouseIsPressed) {
        if (checkMouseInRect(KEY_UI.w)) isW = true; if (checkMouseInRect(KEY_UI.a)) isA = true;
        if (checkMouseInRect(KEY_UI.s)) isS = true; if (checkMouseInRect(KEY_UI.d)) isD = true;
        if (checkMouseInRect(KEY_UI.left)) isLeft = true; if (checkMouseInRect(KEY_UI.right)) isRight = true;
    }

    if (isW) k_sailHeight = constrain(k_sailHeight + 0.012, 0.0, 1.0);
    if (isS) k_sailHeight = constrain(k_sailHeight - 0.012, 0.0, 1.0);
    if (isA) k_rudderAngle = constrain(k_rudderAngle - 0.8, -45, 45);
    if (isD) k_rudderAngle = constrain(k_rudderAngle + 0.8, -45, 45);
    if (isLeft) k_sailAngle = constrain(k_sailAngle - 0.8, -60, 60);
    if (isRight) k_sailAngle = constrain(k_sailAngle + 0.8, -60, 60);

    if (isW || isS || isA || isD || isLeft || isRight) {
        sessionStorage.setItem("k_sail_height", k_sailHeight);
        sessionStorage.setItem("k_sail_angle", k_sailAngle);
        sessionStorage.setItem("k_rudder_angle", k_rudderAngle);
    }
}

function checkMouseInRect(btn) { return (mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h); }

class RiverParticle {
    constructor() { this.pos = createVector(random(0, width), random(0, height)); this.len = random(20, 45); this.alpha = random(40, 120); }
    update(vRiver, northBankY) {
        let angle = radians(45); let speedPx = (vRiver * window.PHYSICS_SCALE);
        this.pos.x += speedPx * cos(angle) * 3; this.pos.y -= speedPx * sin(angle) * 3;
        if (this.pos.x > width) this.pos.x = 0; if (this.pos.y < northBankY) this.pos.y = window.RIVER_START_Y;
    }
    display() {
        stroke(100, 180, 220, this.alpha); strokeWeight(1); noFill();
        beginShape(); vertex(this.pos.x, this.pos.y); vertex(this.pos.x + this.len * 0.4, this.pos.y - this.len * 0.15); endShape();
    }
}

function saveStateToStorage(x, y, vx, vy, heading) { sessionStorage.setItem("chibi_ship_x", x); sessionStorage.setItem("chibi_ship_y", y); sessionStorage.setItem("session_ship_vx", vx); sessionStorage.setItem("session_ship_vy", vy); sessionStorage.setItem("chibi_ship_heading", heading); }

window.setup = setup;
window.draw = draw;