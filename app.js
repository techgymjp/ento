// ===== 構文エラー修正版 app.js =====

class BallThrowJourneyApp {
    constructor() {
        console.log('🚀 BallThrowJourneyApp initializing...');
        
        // Core elements
        this.map = null;
        this.mapElement = document.getElementById('map');
        this.ballElement = document.getElementById('ball');
        this.compassNeedle = document.getElementById('compassNeedle');
        this.gameCanvas = document.getElementById('gameCanvas');
        this.ctx = null;
        
        // Canvas and image data
        this.aerialImages = [];
        this.ballImage = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.ballCanvasX = 0;
        this.ballCanvasY = 0;
        this.backgroundOffsetY = 0;
        
        // Audio elements
        this.sounds = {
            start: new Audio('start.mp3'),
            kick: new Audio('kick.mp3'),
            goal: new Audio('goal.mp3')
        };
        
        // State management
        this.isActive = false;
        this.isCountdownActive = false;
        this.isPermissionGranted = false;
        this.isMapReady = false;
        this.isMapFullyLoaded = false;
        this.isBallMoving = false;
        this.isDetectingShake = false;
        
        // Position data
        this.currentPosition = { lat: 35.4476, lng: 139.6425 };
        this.startPosition = { ...this.currentPosition };
        this.ballPosition = { ...this.currentPosition };
        
        // Sensor data
        this.heading = 0;
        this.absoluteHeading = 0;
        this.tilt = 0;
        this.lastTilt = 0;
        this.tiltSpeed = 0;
        this.lastTime = Date.now();
        
        // Shake detection
        this.accelerationData = [];
        this.maxAcceleration = 0;
        this.shakeThreshold = 8;
        this.totalDistance = 0;
        
        // Animation
        this.animationFrame = 0;
        this.throwPower = 0;
        this.throwAngle = 0;
        this.ballTrailPoints = [];
        
        // Preparation state
        this.isAudioReady = false;
        this.isAerialImagesReady = false;
        this.isBallImageReady = false;
        this.preparationOverlay = null;
        
        // Timers
        this.countdownTimer = null;
        this.countdownElement = null;
        this.preparationTimer = null;
        
        this.updateStatus('位置情報とデバイスセンサーの許可が必要です');
        this.createDebugDisplay();
        console.log('✅ BallThrowJourneyApp initialized');
    }

    // デバッグ表示を作成
    createDebugDisplay() {
        this.debugElement = document.createElement('div');
        this.debugElement.id = 'debugDisplay';
        this.debugElement.style.cssText = `
            position: fixed;
            top: 50px;
            left: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 11px;
            z-index: 10000;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
            display: block;
            border: 2px solid #00ff00;
        `;
        document.body.appendChild(this.debugElement);
        
        // センサー状態確認ボタン
        this.debugSensorCheck = document.createElement('button');
        this.debugSensorCheck.textContent = 'SENSOR';
        this.debugSensorCheck.style.cssText = `
            position: fixed;
            top: 10px;
            right: 130px;
            background: #44ff44;
            color: black;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10001;
            font-weight: bold;
        `;
        this.debugSensorCheck.onclick = () => this.checkSensorStatus();
        document.body.appendChild(this.debugSensorCheck);

        this.debugVisible = true;
        this.showDebug('🚀 最小限デバッグシステム開始');
    }

    // センサー状態確認メソッド
    checkSensorStatus() {
        this.showDebug(`🔍 ===== 手動センサー確認 =====`);
        this.showDebug(`⏰ 確認時刻: ${new Date().toLocaleTimeString()}`);
        this.showDebug(`📱 現在のheading: ${this.heading}°`);
        this.showDebug(`📱 センサー許可: ${this.isPermissionGranted}`);
        this.showDebug(`✅ ===== 確認完了 =====`);
    }

    // デバッグメッセージ表示
    showDebug(message) {
        if (this.debugElement) {
            const timestamp = new Date().toLocaleTimeString();
            const newMessage = `[${timestamp}] ${message}`;
            this.debugElement.textContent = newMessage + '\n' + this.debugElement.textContent;
            
            const lines = this.debugElement.textContent.split('\n');
            if (lines.length > 15) {
                this.debugElement.textContent = lines.slice(0, 15).join('\n');
            }
            this.debugElement.scrollTop = 0;
        }
        console.log(message);
    }
    
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    async startApp() {
        const startBtn = document.getElementById('startBtn');
        if (!startBtn) return;
        
        console.log('🚀 Starting app...');
        this.showDebug('🚀 アプリ開始');
        
        startBtn.disabled = true;
        startBtn.textContent = '初期化中...';
        
        try {
            this.updateStatus('📱 センサー許可を取得中...');
            await this.requestSensorPermission();
            this.setupComplete();
        } catch (error) {
            console.error('❌ Setup error:', error);
            this.showDebug(`❌ セットアップエラー: ${error.message}`);
            this.fallbackSetup();
        }
    }
    
    async requestSensorPermission() {
        this.showDebug('🔐 センサー許可取得開始');
        
        try {
            // iOS 13+ device orientation permission
            if (typeof DeviceOrientationEvent !== 'undefined' && 
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                
                this.showDebug('📲 iOS 13+ 検出 - 許可要求中...');
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                this.showDebug(`📋 許可結果: ${orientationPermission}`);
                
                if (orientationPermission !== 'granted') {
                    throw new Error('デバイス方向センサーの許可が必要です');
                }
            }
            
            // iOS 13+ device motion permission
            if (typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                
                this.showDebug('📲 Motion許可要求中...');
                const motionPermission = await DeviceMotionEvent.requestPermission();
                this.showDebug(`📋 Motion許可結果: ${motionPermission}`);
                
                if (motionPermission !== 'granted') {
                    throw new Error('デバイスモーションセンサーの許可が必要です');
                }
            }
            
            this.startSensors();
            
        } catch (error) {
            this.showDebug(`❌ センサー許可エラー: ${error.message}`);
            this.startSensors(); // フォールバックで続行
        }
    }
    
    startSensors() {
        this.showDebug('🔧 センサー開始処理');
        
        // Device orientation
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', (event) => {
                this.handleOrientation(event);
            }, { passive: true });
            this.showDebug('✅ DeviceOrientationイベント登録完了');
        }
        
        this.isPermissionGranted = true;
        this.showDebug('✅ センサー開始完了');
    }
    
    handleOrientation(event) {
        if (!this.isPermissionGranted) return;
        
        let newHeading = 0;
        
        if (event.webkitCompassHeading !== undefined) {
            newHeading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
            newHeading = 360 - event.alpha;
            if (newHeading >= 360) newHeading -= 360;
            if (newHeading < 0) newHeading += 360;
        }
        
        this.heading = newHeading;
        this.updateDisplay();
    }
    
    updateDisplay() {
        const headingElement = document.getElementById('heading');
        const compassElement = document.getElementById('compass');
        
        if (headingElement) {
            headingElement.textContent = Math.round(this.heading) + '°';
        }
        if (compassElement) {
            compassElement.textContent = this.getCompassDirection(this.heading);
        }
        if (this.compassNeedle) {
            this.compassNeedle.style.transform = `rotate(${this.heading}deg)`;
        }
    }
    
    getCompassDirection(heading) {
        const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    setupComplete() {
        this.updateStatus('🎯 センサー準備完了！');
        this.showDebug('✅ セットアップ完了');
        
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.textContent = '✅ 準備完了';
            startBtn.disabled = false;
        }
    }
    
    fallbackSetup() {
        setTimeout(() => {
            this.setupComplete();
        }, 1000);
    }
}

// Global variables
let app = null;

// Global function
function startApp() {
    console.log('🚀 startApp called');
    
    const startBtn = document.getElementById('startBtn');
    if (!startBtn) {
        console.error('❌ Start button not found');
        return;
    }
    
    if (startBtn.disabled) {
        console.log('⚠️ Button already disabled');
        return;
    }

    if (!app) {
        app = new BallThrowJourneyApp();
    }
    
    app.startApp();
}

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded');
    
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startApp);
        console.log('✅ Button event listener added');
    } else {
        console.error('❌ startBtn not found in DOM');
    }
});