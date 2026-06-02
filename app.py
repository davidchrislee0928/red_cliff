import streamlit as st
import streamlit.components.v1 as components
import json
import os
import sqlite3
import datetime
import time
from threading import Thread

# ==========================================
# 1. 页面配置与基础声明
# ==========================================
st.set_page_config(page_title="赤壁之战：多物理场造船实验室", layout="wide")
st.title("🏹 赤壁之战：先锋战船多物理场组件化实验室")
st.markdown("**📁 战术起跑断路版 (30倍速快速测试)**：已完全剔除外部冲突组件。首屏100%精致不卡死，点击按钮触发推演。")

# ==========================================
# 💾 2. SQLite3 数据库事务核心引擎与 Flask 异步网关
# ==========================================
DB_FILE = os.path.join(os.path.dirname(__file__), "chibi_laboratory.db")

def init_database():
    """安全初始化内嵌轻量关系表结构"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS run_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            time_used REAL,
            config TEXT
        )
    """)
    conn.commit()
    conn.close()

def load_db_records():
    """从数据库加载历史风云记录"""
    init_database()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT timestamp, id, time_used, config FROM run_records ORDER BY time_used ASC LIMIT 10")
        rows = cursor.fetchall()
    except:
        rows = []
    conn.close()
    
    records = []
    for row in rows:
        records.append({
            "timestamp": row[0],
            "run_index": row[1],
            "time_used": row[2],
            "config": row[3]
        })
    return records

# 🌟【本地超轻量数据总线 Flask 网关（端口8055）】
def run_mini_gateway():
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        os.system("pip install flask flask-cors")
        from flask import Flask, request, jsonify
        from flask_cors import CORS

    app = Flask("ChibiLocalGateway")
    CORS(app)

    @app.route('/save', methods=['POST'])
    def save_node():
        data = request.json
        t_used = data.get("time_used")
        cfg_str = data.get("config")
        
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            "INSERT INTO run_records (timestamp, time_used, config) VALUES (?, ?, ?)",
            (now_str, round(float(t_used), 2), cfg_str)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "written": t_used})

    app.run(port=8055, debug=False, use_reloader=False)

# 在独立后台守护线程中启动本地持久化总线网关
if "gateway_started" not in st.session_state:
    init_database()
    st.session_state["gateway_started"] = True
    Thread(target=run_mini_gateway, daemon=True).start()

if "sim_init_timestamp" not in st.session_state:
    st.session_state["sim_init_timestamp"] = time.time()
if "is_running_now" not in st.session_state:
    st.session_state["is_running_now"] = False

# ==========================================
# 📥 3. 左侧边栏参数工坊区与战术起跑控制器
# ==========================================
st.sidebar.header("🌊 实时环境参数")
w_river = st.sidebar.slider("长江实际宽度 (米)", 1500, 3000, 2000, step=100)
v_river = st.sidebar.slider("实时江水流速 (m/s, 西南→东北)", 0.5, 3.0, 1.2, step=0.1)
v_wind = st.sidebar.slider("实时东南风速 (m/s)", 5.0, 25.0, 14.0, step=0.5)

st.sidebar.markdown("---")
st.sidebar.header("🛠️ 战船改装 experiment 工坊")

keel_type = st.sidebar.selectbox("选择大船底架龙骨：", ["传统平底无龙骨沙船", "汉代半通材重木短龙骨", "突厥式硬木深尖龙骨"])
keel_mapping = {
    "传统平底无龙骨沙船": {"mass": 0, "depth": 0.0, "idx": 0},
    "汉代半通材重木短龙骨": {"mass": 3000, "depth": 1.5, "idx": 1},
    "突厥式硬木深尖龙骨": {"mass": 6000, "depth": 3.0, "idx": 2}
}
sel_keel = keel_mapping[keel_type]

sail_type = st.sidebar.selectbox("选择上层风帆款式：", ["汉代编织篾席硬帆", "古典罗马多层方帆", "阿拉伯高气动三角帆"])
sail_mapping = {
    "汉代编织篾席硬帆": {"mass": 1500, "area": 120, "eff": 0.45, "idx": 0},
    "古典罗马多层方帆": {"mass": 3500, "area": 170, "eff": 0.62, "idx": 1},
    "阿拉伯高气动三角帆": {"mass": 1800, "area": 105, "eff": 0.75, "idx": 2}
}
sel_sail = sail_mapping[sail_type]

u_human = st.sidebar.slider("【实时推进】橹桨总出力 (kN)", 0, 60, 25, step=1)

# 🕹️【原生推演控制器组件】
st.sidebar.markdown("---")
st.sidebar.subheader("🕹️ 战术推演控制台")

if st.sidebar.button("🚀 开始执行战船突入推演", key="py_start_run", type="primary"):
    st.session_state["is_running_now"] = True
    st.rerun()

if st.sidebar.button("🔄 刷新风云榜/重置推演", key="py_manual_reset"):
    st.session_state["sim_init_timestamp"] = time.time()
    st.session_state["is_running_now"] = False
    st.markdown("<script>sessionStorage.clear();</script>", unsafe_allow_html=True)
    st.rerun()

# 🏆 排行榜可视化静态渲染（源于嵌入式 SQLite3 关系表）
st.sidebar.markdown("---")
st.sidebar.header("🏆 赤壁冲锋风云榜 (SQLite)")

records_list = load_db_records()
if not records_list:
    st.sidebar.info("📊 关系表内暂无记录。请先点击起跑推演，撞线后点击上方刷新按钮查看。")
else:
    for idx, item in enumerate(records_list):
        medals = ["🥇", "🥈", "🥉"]
        prefix = medals[idx] if idx < 3 else f"🏅 航次"
        st.sidebar.markdown(
            f"""
            <div style="background-color:#1c2e42; padding:10px; border-radius:6px; margin-bottom:6px; border-left:4px solid #3498db;">
                <b style="color:#ffffff; font-size:13px;">{prefix} 用时: {item['time_used']} 秒</b><br/>
                <small style="color:#a3b8cc; font-size:11px;">🕒 节点: {item['timestamp']} | 编号 #{item['run_index']}</small><br/>
                <span style="color:#f39c12; font-size:11px;">⚙️ {item['config']}</span>
            </div>
            """, 
            unsafe_allow_html=True
        )

# ==========================================
# 🎨 4. 全宽主画布区域 (标准无参数污染并网)
# ==========================================
base_dir = os.path.dirname(__file__)
current_params = {
    "w_river": int(w_river), "v_river": float(v_river), "v_wind": float(v_wind),
    "u_human": int(u_human), "reset_trigger": bool(time.time() - st.session_state["sim_init_timestamp"] < 0.6), "avatar_data": "",
    "keel_mass": int(sel_keel["mass"]), "keel_depth": float(sel_keel["depth"]), "keel_idx": int(sel_keel["idx"]),
    "sail_mass": int(sel_sail["mass"]), "sail_area": int(sel_sail["area"]), "sail_eff": float(sel_sail["eff"]), "sail_idx": int(sel_sail["idx"]),
    "run_trigger": bool(st.session_state["is_running_now"]) # 将原生的开始按键状态精准喂给前端
}

def read_js_file(filename):
    file_path = os.path.join(base_dir, filename)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f: return f.read()
    return ""

p5_sail_asset_js = read_js_file("sail.js")
p5_keel_asset_js = read_js_file("keel.js")
p5_physics_js = read_js_file("physics.js")
p5_core_js = read_js_file("canvas_core.js")
p5_sketch_js = read_js_file("sketch.js")

html_multi_file_code = f"""
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.6.0/p5.js"></script>
    <style>
        body {{ margin: 0; padding: 0; background-color: #0b131e; overflow: hidden; }}
        canvas {{ display: block; margin: 0 auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }}
    </style>
</head>
<body>
    <div id="py-bridge" data-params='{json.dumps(current_params)}' style="display:none;"></div>

    <script>
        setInterval(() => {{
            let bridge = document.getElementById("py-bridge");
            if(bridge) {{
                let freshParams = bridge.getAttribute("data-params");
                window.localParams = JSON.parse(freshParams);
            }}
        }}, 40);

        {p5_sail_asset_js}
        {p5_keel_asset_js}
        {p5_physics_js}
        {p5_core_js}
        {p5_sketch_js}
    </script>
</body>
</html>
"""

# 🌟 极致标准纯净的 HTML 挂载，100% 没有任何非法参数污染
components.html(html_multi_file_code, height=1950, scrolling=False)