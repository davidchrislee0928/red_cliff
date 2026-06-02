import streamlit as st
import streamlit.components.v1 as components
import json
import os
import base64

# ==========================================
# 1. 页面配置与标题
# ==========================================
st.set_page_config(page_title="赤壁之战：三文件完美解耦仿真", layout="wide")
st.title("🏹 赤壁之战：黄盖火攻多物理场时序级仿真器")
st.markdown("**📁 三文件解耦规范工程版**：已注入状态保持缓存与超深防吞底座。拖动滑块无重置，刷新页面可重置。")

# 侧边栏重置标志位
reset_trigger = st.sidebar.button("🔄 重新推演（战船重返起点）")

# ==========================================
# 2. 交互式控制面板
# ==========================================
st.sidebar.header("🌊 实时环境参数")
w_river = st.sidebar.slider("长江实际宽度 (米)", 1500, 3000, 2000, step=100)
v_river = st.sidebar.slider("实时江水流速 (m/s, 西南→东北)", 0.5, 3.0, 1.2, step=0.1)
v_wind = st.sidebar.slider("实时东南风速 (m/s)", 5.0, 25.0, 14.0, step=0.5)

st.sidebar.markdown("---")
st.sidebar.header("🕹️ 航行实时轴向指令")
rudder = st.sidebar.slider("【实时船舵】偏角 (度, 负朝西/正朝东)", -45, 45, -20, step=1)
sail = st.sidebar.slider("【实时席帆】攻角 (度)", -60, 60, 25, step=1)
sail_raised = st.sidebar.checkbox("当前状态：升起席帆", value=True)

st.sidebar.markdown("---")
st.sidebar.header("💪 实时动力源")
u_human = st.sidebar.slider("【实时推进】橹桨总出力 (kN)", 0, 60, 25, step=1)

# ==========================================
# 📸 核心路径重构：适配 Hugging Face /data/static 路由
# ==========================================
base_dir = os.path.dirname(__file__)

# 🎯 定义两种可能的路径：1.云端持久化路径  2.本地备用路径
hf_data_path = os.path.join("/data", "static", "avatar.jpg")
local_backup_path = os.path.join(base_dir, "static", "avatar.jpg")

avatar_path = ""
avatar_base64 = ""

# 智能探测：如果存在 HF 的 /data 挂载路径则优先读取，否则自动回退到项目根目录下的旧路径
if os.path.exists(hf_data_path):
    avatar_path = hf_data_path
    st.sidebar.info("📂 已成功从云端 `/data/static/` 路径载入头像资产")
elif os.path.exists(local_backup_path):
    avatar_path = local_backup_path
    st.sidebar.info("🏠 已从本地项目 `static/` 路径载入头像资产")
else:
    st.sidebar.warning("⚠️ 未能在 `/data/static/` 或本地目录下找到 `avatar.jpg`")

# 如果路径探测成功，执行安全的内存 Base64 编码注入
if avatar_path:
    try:
        with open(avatar_path, "rb") as img_file:
            encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
            avatar_base64 = f"data:image/jpeg;base64,{encoded_string}"
    except Exception as e:
        st.sidebar.error(f"⚠️ 头像数据流转 Base64 失败: {e}")

# 将解算好的内存头像参数通过网桥下发
current_params = {
    "w_river": w_river,
    "v_river": v_river,
    "v_wind": v_wind,
    "rudder": rudder,
    "sail": sail,
    "sail_raised": sail_raised,
    "u_human": u_human,
    "reset_trigger": reset_trigger,
    "avatar_data": avatar_base64  
}

# ==========================================
# 3. 动态读取外部依赖 JS 文件
# ==========================================
def read_js_file(filename):
    file_path = os.path.join(base_dir, filename)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        st.error(f"❌ 运行错误：未能成功读取 `{filename}` 文件，请检查路径！")
        return ""

p5_physics_js = read_js_file("physics.js")
p5_sketch_js = read_js_file("sketch.js")

# ==========================================
# 4. 双核心混合嵌套装配
# ==========================================
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
        let baseWidth = 900;
        let baseHeight = 1820;

        // 加载物理场核心
        {p5_physics_js}

        // 加载分层图形内核
        {p5_sketch_js}

        // 定时轮桥传输
        setInterval(() => {{
            let bridge = document.getElementById("py-bridge");
            if(bridge) {{
                let freshParams = bridge.getAttribute("data-params");
                window.localParams = JSON.parse(freshParams);
            }}
        }}, 40);
    </script>
</body>
</html>
"""

components.html(html_multi_file_code, height=1950, scrolling=False)