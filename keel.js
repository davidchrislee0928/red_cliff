/**
 * ⚓ keel.js - 龙骨组件基类家族（流体力学资产库）
 */

class BaseKeel {
    constructor(name, mass, depth) {
        this.name = name;
        this.mass = mass;
        this.depth = depth;
    }

    // 核心多态接口：动态修改大船的纵向摩擦与横向切水阻力底座
    modifyHydroDrag(baseKLong, baseKLat) {
        return {
            kLong: baseKLong + (this.depth * 15),
            kLat: baseKLat + (this.depth * 1400) // 龙骨每加深1米，侧舷剖面切水抗力呈线性暴涨！
        };
    }
}

// 🎯 派生 1：三国传统平底无龙骨沙船底座（浅吃水，不耐大江横掠侧滑，KLat增幅为0）
class ThreeKingdomKeel extends BaseKeel {
    modifyHydroDrag(baseKLong, baseKLat) {
        return { kLong: baseKLong, kLat: baseKLat };
    }
}

// 🎯 派生 2：波斯半通材木质短龙骨（适度吃水，横向防倾性能中等）
class PersianKeel extends BaseKeel {
    modifyHydroDrag(baseKLong, baseKLat) {
        return { kLong: baseKLong + 25, kLat: baseKLat + 1800 };
    }
}

// 🎯 派生 3：突厥硬木深尖龙骨（深吃水高配，横向阻力疯狂暴涨，死死锁住横向位移）
class TurkishKeel extends BaseKeel {
    modifyHydroDrag(baseKLong, baseKLat) {
        return { kLong: baseKLong + 50, kLat: baseKLat + 4200 };
    }
}

// 全局注册入浏览器视界
window.BaseKeel = BaseKeel;
window.ThreeKingdomKeel = ThreeKingdomKeel;
window.PersianKeel = PersianKeel;
window.TurkishKeel = TurkishKeel;