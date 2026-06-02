/**
 * ⛵ sail.js - 风帆组件基类家族（空气动力学资产库）
 */

class BaseSail {
    constructor(name, mass, area, efficiency) {
        this.name = name;
        this.mass = mass;
        this.area = area;
        this.efficiency = efficiency;
    }

    // 核心多态物理接口：解算当前风帆产生的升力与空气阻力
    calculateAeroForces(vAppWindX, vAppWindY, vAppWind, heading, sailDeg, sailHeight) {
        if (vAppWind < 0.1 || sailHeight <= 0) {
            return { fLiftMag: 0, fDragAirMag: 0, appWindDir: 0, liftDir: 0 };
        }

        let appWindDir = atan2(vAppWindY, vAppWindX);
        let sailAbsRad = heading + radians(sailDeg);
        let alpha = appWindDir - sailAbsRad; // 计算视风迎角 (Angle of Attack)

        // 调用子类复写的多态气动系数
        let coefficients = this.getCoefficients(alpha);
        let effectiveArea = this.area * sailHeight;

        // 运用伯努利公式解算气动力绝对牛顿额度
        let fLiftMag = abs(0.5 * 1.225 * effectiveArea * coefficients.cL * (vAppWind * vAppWind)) * this.efficiency;
        let fDragAirMag = abs(0.5 * 1.225 * effectiveArea * coefficients.cD * (vAppWind * vAppWind)) * this.efficiency;
        let liftDir = appWindDir + (alpha >= 0 ? -HALF_PI : HALF_PI);

        return { fLiftMag, fDragAirMag, appWindDir, liftDir };
    }

    getCoefficients(alpha) { return { cL: 0, cD: 0 }; }
}

// 🎯 派生 1：三国大汉篾席硬帆（迎风升力较好，传统硬帆结构）
class ThreeKingdomSail extends BaseSail {
    getCoefficients(alpha) {
        return { cL: 1.3 * sin(2 * alpha), cD: 1.1 * (1.0 - cos(2 * alpha)) };
    }
}

// 🎯 派生 2：古典罗马多层方帆（顺风吃风极强，阻力系数高，高迎角段升力骤降）
class RomanSquareSail extends BaseSail {
    getCoefficients(alpha) {
        return { cL: 1.0 * sin(2 * alpha), cD: 1.6 * (1.0 - cos(2 * alpha)) };
    }
}

// 🎯 派生 3：阿拉伯高气动三角帆（极限切风性能，拥有极高的高角度升力转化率）
class ArabicSail extends BaseSail {
    getCoefficients(alpha) {
        return { cL: 1.6 * sin(2 * alpha), cD: 0.75 * (1.0 - cos(2 * alpha)) };
    }
}

// 全局注册入浏览器视界
window.ThreeKingdomSail = ThreeKingdomSail; // 无缝兼容旧索引
window.RomanSquareSail = RomanSquareSail;
window.ArabLateenSail = ArabicSail;