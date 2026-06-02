import streamlit as st
import streamlit.components.v1 as components
import json
import os
import base64  # 🎯 新增：用于将本地头像转化为内存 base64 字符串

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
# 📸 核心微调：读取同级目录下的 avatar.jpg 并安全转化为 Base64
# ==========================================
base_dir = os.path.dirname(__file__)
avatar_path = os.path.join(base_dir, "avatar.jpg")
avatar_base64 = ""

if os.path.exists(avatar_path):
    try:
        with open(avatar_path, "rb") as img_file:
            encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
            # 拼装成前端 img 标签和 p5.js loadImage 直接可读的 Data URL 格式
            avatar_base64 = f"data:image/jpeg;base64,{encoded_string}"
    except Exception as e:
        st.sidebar.error(f"⚠️ 头像图片读取失败: {e}")
else:
    st.sidebar.warning("⚠️ 未在当前目录下找到 `avatar.jpg` 文件，随船头像将无法显示。")

# 将图片数据作为参数直接注入数据网桥
current_params = {
    "w_river": w_river,
    "v_river": v_river,
    "v_wind": v_wind,
    "rudder": rudder,
    "sail": sail,
    "sail_raised": sail_raised,
    "u_human": u_human,
    "reset_trigger": reset_trigger,
    "avatar_data": avatar_base64  # 🎯 焊死数据通道，直接下发到前端内存
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
        // 跨文件共享基础变量前置定义
        let baseWidth = 900;
        let baseHeight = 1820;

        // 【严格加载顺序】：1. 先声明并执行完物理计算逻辑，把常量锁死进 window
        {p5_physics_js}

        // 【严格加载顺序】：2. 物理类在顶层全局注册完毕后，再拉起图形分层核心
        {p5_sketch_js}

        // 会话级网桥轮询
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

# 高度外壳直接放大到 1950，杜绝一切由于底部截断引起的公式隐藏！
components.html(html_multi_file_code, height=1950, scrolling=False)