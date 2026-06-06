/**
 * 🧱 canvas_core.js - 核心数据生命周期、全局拦截器与时序大循环时钟（Windows 本地在途改装完美落锁版）
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

    // ===================================================================
    // 🌟【第一层防线：原生按钮清盘拦截】
    // ===================================================================
    if (p.reset_trigger) {
        localStorage.clear();
        sessionStorage.clear();
        ship = new window.WarShip(2400, 0);
        simTime = 0;
        isExploded = false;
        isRecordLogged = false;
        saveStateToStorage(2400, 0, 0, 0, radians(135));
    }

    // ===================================================================
    // 🌟【第二层防线：在途换装无感复活锁】
    // ===================================================================
    if (ship === null) {
        let localSavedX = localStorage.getItem("chibi_ship_x_lock");
        // 核心检测：如果在途缓存有坐标，且不是手动点击了重置按钮，则强制原地继承状态复活，杜绝缩回原点
        if (localSavedX && localSavedX !== "null" && !p.reset_trigger && localStorage.getItem("chibi_exploded_lock") !== "true") {
            ship = new window.WarShip(parseFloat(localSavedX), parseFloat(localStorage.getItem("chibi_ship_y_lock")));
            ship.vel.set(parseFloat(localStorage.getItem("session_ship_vx_lock")) || 0, parseFloat(localStorage.getItem("session_ship_vy_lock")) || 0);
            ship.heading = parseFloat(localStorage.getItem("chibi_ship_heading_lock")) || radians(135);
            simTime = parseFloat(localStorage.getItem("chibi_sim_time_lock")) || 0;
            isExploded = false;
            isRecordLogged = false;
        } else {
            // 真正属于纯净初始状态时，方允许在起点生成新实例
            ship = new window.WarShip(2400, 0);
            simTime = 0;
            isExploded = false;
            isRecordLogged = false;
            saveStateToStorage(2400, 0, 0, 0, radians(135));
        }
    }

    if (window.onChibiEquipExt) {
        window.onChibiEquipExt(ship, p);
    }

    // 🌟【第三层防线：受控物理微分演进与高频实时备份】
    if (p.run_trigger && !isExploded) {
        ship.applyTruePhysics(p); 
        
        let timeStepMultiplier = 1; // 1倍速常规科学物理演进尺度
        ship.update((1 / 60) * timeStepMultiplier); 
        
        // 🔥 每一帧都高频固化当前状态至 localStorage 中，彻底对抗 iframe 重新挂载产生的状态蒸发
        localStorage.setItem("chibi_ship_x_lock", ship.pos.x);
        localStorage.setItem("chibi_ship_y_lock", ship.pos.y);
        localStorage.setItem("session_ship_vx_lock", ship.vel.x);
        localStorage.setItem("session_ship_vy_lock", ship.vel.y);
        localStorage.setItem("chibi_ship_heading_lock", ship.heading);
        localStorage.setItem("chibi_sim_time_lock", simTime);
        localStorage.setItem("chibi_exploded_lock", "false");
        
        saveStateToStorage(ship.pos.x, ship.pos.y, ship.vel.x, ship.vel.y, ship.heading);
        
        if (ship.pos.y >= p.w_river) { 
            isExploded = true; 
            sessionStorage.setItem("chibi_exploded", "true"); 
            localStorage.setItem("chibi_exploded_lock", "true");
        }
    }

    // 异步 Fetch 直通网关回传
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
    
    if (p.run_trigger && !isExploded) { 
        simTime += (1 / 60); 
    } 
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