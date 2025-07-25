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
        
        // Preload audio files
        Object.values(this.sounds).forEach(audio => {
            audio.preload = 'auto';
            audio.volume = 0.8;
            audio.addEventListener('canplaythrough', () => {
                console.log(`✅ Audio ${audio.src} loaded successfully`);
            });
            audio.addEventListener('error', (e) => {
                console.error(`❌ Audio ${audio.src} failed to load:`, e);
            });
        });
        
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

        // 【追加】デバッグ表示要素を作成
        this.createDebugDisplay();
        console.log('✅ BallThrowJourneyApp initialized');
    }

    // 【強化版】デバッグ表示を作成
// 【ステップ2】既存のcreateDebugDisplayメソッドを以下で完全置き換えしてください

// 【強化版】デバッグ表示を作成（ちらつき防止版）
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
        transform: translateZ(0);
        will-change: contents;
        backface-visibility: hidden;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeSpeed;
    `;
    document.body.appendChild(this.debugElement);
    
    // デバッグ表示の切り替えボタン
    this.debugToggle = document.createElement('button');
    this.debugToggle.textContent = 'DEBUG';
    this.debugToggle.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10001;
        font-weight: bold;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;
    this.debugToggle.onclick = () => this.toggleDebug();
    document.body.appendChild(this.debugToggle);
    
    // クリアボタン
    this.debugClear = document.createElement('button');
    this.debugClear.textContent = 'CLEAR';
    this.debugClear.style.cssText = `
        position: fixed;
        top: 10px;
        right: 70px;
        background: #4444ff;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10001;
        font-weight: bold;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;
    this.debugClear.onclick = () => this.clearDebug();
    document.body.appendChild(this.debugClear);

    this.debugVisible = true;
    
    // 【新規追加】ちらつき防止用の変数初期化
    this.debugUpdateQueue = [];
    this.lastDebugUpdate = 0;
    this.debugUpdateTimer = null;
    
    this.showDebug('🚀 スマホ対応デバッグシステム開始（ちらつき修正版）');
}
 



// 【強化版】デバッグメッセージ表示（ちらつき防止版）
showDebug(message) {
    if (this.debugElement) {
        const timestamp = new Date().toLocaleTimeString();
        const newMessage = `[${timestamp}] ${message}`;
        
        // 【修正】頻繁な更新を制御
        if (!this.debugUpdateQueue) {
            this.debugUpdateQueue = [];
            this.lastDebugUpdate = 0;
        }
        
        // キューに追加
        this.debugUpdateQueue.push(newMessage);
        
        // 100ms間隔で更新（ちらつき防止）
        const now = Date.now();
        if (now - this.lastDebugUpdate >= 100) {
            this.flushDebugQueue();
            this.lastDebugUpdate = now;
        } else if (!this.debugUpdateTimer) {
            // タイマーがない場合は設定
            this.debugUpdateTimer = setTimeout(() => {
                this.flushDebugQueue();
                this.debugUpdateTimer = null;
                this.lastDebugUpdate = Date.now();
            }, 100);
        }
    }
    
    // コンソールにも出力（PC用）
    console.log(message);
}


   flushDebugQueue() {
    if (!this.debugElement || !this.debugUpdateQueue || this.debugUpdateQueue.length === 0) {
        return;
    }
    
    // キューの全メッセージを一度に処理
    const newMessages = this.debugUpdateQueue.join('\n');
    this.debugUpdateQueue = [];
    
    // 【修正】一度にまとめて更新
    this.debugElement.textContent = newMessages + '\n' + this.debugElement.textContent;
    
    // 20行を超えたら古いメッセージを削除
    const lines = this.debugElement.textContent.split('\n');
    if (lines.length > 20) {
        this.debugElement.textContent = lines.slice(0, 20).join('\n');
    }
    
    // 自動スクロール（最新メッセージが見えるように）
    this.debugElement.scrollTop = 0;
}

    
// デバッグ表示切り替え
toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugElement.style.display = this.debugVisible ? 'block' : 'none';
    this.debugToggle.style.background = this.debugVisible ? '#ff4444' : '#888888';
    console.log('Debug表示切り替え:', this.debugVisible);
}

// デバッグクリア
clearDebug() {
    if (this.debugElement) {
        this.debugElement.textContent = '';
        this.showDebug('🧹 デバッグログクリア');
        console.log('Debug log cleared');
    }
}

// 航空写真の詳細状態をデバッグ表示
debugAerialImageState() {
    if (this.aerialImages.length > 0 && this.aerialImages[0].image) {
        const img = this.aerialImages[0].image;
        this.showDebug(`📸 航空写真状態:`);
        this.showDebug(`  - complete: ${img.complete}`);
        this.showDebug(`  - naturalWidth: ${img.naturalWidth}`);
        this.showDebug(`  - naturalHeight: ${img.naturalHeight}`);
        this.showDebug(`  - width: ${img.width}`);
        this.showDebug(`  - height: ${img.height}`);
        this.showDebug(`  - src先頭: ${img.src.substring(0, 60)}...`);
    } else {
        this.showDebug('❌ 航空写真が存在しない');
    }
}


// キャンバス状態をデバッグ表示
debugCanvasState() {
    this.showDebug(`🖼️ キャンバス状態:`);
    this.showDebug(`  - canvasWidth: ${this.canvasWidth}`);
    this.showDebug(`  - canvasHeight: ${this.canvasHeight}`);
    this.showDebug(`  - ctx存在: ${!!this.ctx}`);
    this.showDebug(`  - gameCanvas存在: ${!!this.gameCanvas}`);
    if (this.gameCanvas) {
        this.showDebug(`  - canvas表示: ${this.gameCanvas.style.display}`);
    }
}

// エラー詳細表示
showDetailedError(context, error) {
    this.showDebug(`❌ ${context}でエラー発生:`);
    this.showDebug(`  - メッセージ: ${error.message}`);
    if (error.stack) {
        const stackLines = error.stack.split('\n').slice(0, 3); // 最初の3行のみ
        stackLines.forEach(line => {
            this.showDebug(`  - ${line.trim()}`);
        });
    }
    console.error(`${context}エラー:`, error);
}



    // 2点間の距離を計算（メートル単位）
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // 地球の半径（メートル）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    async startApp() {
        const startBtn = document.getElementById('startBtn');
        if (!startBtn) return;
        
        console.log('🚀 Starting app...');
        startBtn.disabled = true;
        startBtn.textContent = '初期化中...';
        
        try {
            // Get location
            this.updateStatus('📍 位置情報を取得中...');
            await this.getCurrentPosition();
            
            // Initialize map
            this.updateStatus('🗺️ 地図を準備中...');
            await this.initMap();
            
            // Request sensor permissions
            this.updateStatus('📱 センサー許可を取得中...');
            await this.requestSensorPermission();
            
            this.setupComplete();
            
        } catch (error) {
            console.error('❌ Setup error:', error);
            this.showError('初期化エラー: ' + error.message);
            this.fallbackSetup();
        }
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('⚠️ Geolocation not supported');
                resolve();
                return;
            }
            
            const options = {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.startPosition = { ...this.currentPosition };
                    this.ballPosition = { ...this.currentPosition };
                    console.log('✅ Position obtained:', this.currentPosition);
                    resolve();
                },
                (error) => {
                    console.warn('⚠️ Geolocation failed:', error.message);
                    resolve();
                },
                options
            );
        });
    }
    
    async initMap() {
        document.getElementById('loading').style.display = 'block';
        
        try {
            if (!window.google) {
                await this.loadGoogleMapsAPI();
            }
            
            this.map = new google.maps.Map(this.mapElement, {
                center: this.currentPosition,
                zoom: 20,
                mapTypeId: google.maps.MapTypeId.SATELLITE,
                disableDefaultUI: true,
                gestureHandling: 'none',
                heading: 0,
                tilt: 0,
                styles: [
                    {
                        featureType: 'all',
                        elementType: 'labels',
                        stylers: [{ visibility: 'off' }]
                    }
                ]
            });
            
            google.maps.event.addListenerOnce(this.map, 'idle', () => {
                console.log('✅ Map is ready');
                this.isMapReady = true;
                
                setTimeout(() => {
                    this.isMapFullyLoaded = true;
                    console.log('✅ Map fully loaded');
                }, 2000);
            });
            
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            throw error;
        }
        
        document.getElementById('loading').style.display = 'none';
    }
    
    loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDbZWtPobAYr04A8da3OUOjtNNdjfvkbXA&libraries=geometry`;
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log('✅ Google Maps API loaded');
                resolve();
            };
            
            script.onerror = () => {
                console.error('❌ Failed to load Google Maps API');
                reject(new Error('Google Maps API loading failed'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    async requestSensorPermission() {
    this.showDebug('🔐 ===== センサー許可取得開始 =====');
    
    try {
        // ブラウザとプラットフォームの確認
        this.showDebug(`🌐 ブラウザ情報:`);
        this.showDebug(`  - UserAgent: ${navigator.userAgent.substring(0, 100)}...`);
        this.showDebug(`  - HTTPS: ${location.protocol === 'https:'}`);
        this.showDebug(`  - localhost: ${location.hostname === 'localhost'}`);
        
        // iOS 13+ device orientation permission
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            
            this.showDebug(`📲 iOS 13+ 検出 - Orientation許可要求中...`);
            
            const orientationPermission = await DeviceOrientationEvent.requestPermission();
            this.showDebug(`📋 Orientation許可結果: ${orientationPermission}`);
            
            if (orientationPermission !== 'granted') {
                this.showDebug(`❌ Orientation許可拒否`);
                throw new Error('デバイス方向センサーの許可が必要です');
            } else {
                this.showDebug(`✅ Orientation許可取得成功`);
            }
        } else {
            this.showDebug(`📱 iOS 13+以外 - 許可要求不要`);
        }
        
        // iOS 13+ device motion permission
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            
            this.showDebug(`📲 iOS 13+ Motion許可要求中...`);
            
            const motionPermission = await DeviceMotionEvent.requestPermission();
            this.showDebug(`📋 Motion許可結果: ${motionPermission}`);
            
            if (motionPermission !== 'granted') {
                this.showDebug(`❌ Motion許可拒否`);
                throw new Error('デバイスモーションセンサーの許可が必要です');
            } else {
                this.showDebug(`✅ Motion許可取得成功`);
            }
        } else {
            this.showDebug(`📱 Motion許可要求不要`);
        }
        
        this.showDebug(`🚀 センサー開始処理実行...`);
        this.startSensors();
        
    } catch (error) {
        this.showDebug(`❌ センサー許可エラー: ${error.message}`);
        console.warn('⚠️ Sensor permission failed:', error);
        this.showDebug(`🔄 フォールバックでセンサー開始...`);
        this.startSensors();
    }
}
  
    
    
    startSensors() {
    this.showDebug('🔧 ===== センサー開始処理 =====');
    
    // デバイス情報の詳細確認
    this.showDebug(`📱 デバイス情報:`);
    this.showDebug(`  - UserAgent: ${navigator.userAgent.substring(0, 80)}...`);
    this.showDebug(`  - DeviceOrientationEvent: ${typeof DeviceOrientationEvent !== 'undefined'}`);
    this.showDebug(`  - DeviceMotionEvent: ${typeof DeviceMotionEvent !== 'undefined'}`);
    
    // Device orientation
    if (typeof DeviceOrientationEvent !== 'undefined') {
        this.showDebug(`📡 DeviceOrientationイベント登録開始...`);
        
        // テスト用のイベントリスナー
        const testListener = (event) => {
            //this.showDebug(`🎯 テストイベント受信: alpha=${event.alpha}, beta=${event.beta}`);
            this.handleOrientation(event);
        };
        
        window.addEventListener('deviceorientation', testListener, { passive: true });
        this.showDebug(`✅ DeviceOrientationイベント登録完了`);
        
        // 絶対方向イベントも登録
        window.addEventListener('deviceorientationabsolute', (event) => {
            //this.showDebug(`🧭 AbsoluteOrientationイベント受信`);
            this.handleAbsoluteOrientation(event);
        }, { passive: true });
        
        this.showDebug(`✅ DeviceOrientationAbsoluteイベント登録完了`);
        
        // 【追加】イベント発生確認用のタイマー
        setTimeout(() => {
            this.showDebug(`⏰ 5秒経過 - センサーイベント受信状況確認`);
            if (this.heading === 0) {
                this.showDebug(`⚠️ headingが初期値のまま - イベント未受信の可能性`);
                this.troubleshootSensors();
            } else {
                this.showDebug(`✅ センサーイベント正常受信中`);
            }
        }, 5000);
        
    } else {
        this.showDebug(`❌ DeviceOrientationEvent未対応`);
    }
    
    // Device motion for shake detection
    if (typeof DeviceMotionEvent !== 'undefined') {
        this.showDebug(`📡 DeviceMotionイベント登録中...`);
        
        window.addEventListener('devicemotion', (event) => {
            this.handleMotion(event);
        }, { passive: true });
        
        this.showDebug(`✅ DeviceMotionイベント登録完了`);
    } else {
        this.showDebug(`❌ DeviceMotionEvent未対応 - フォールバック設定`);
        this.setupFallbackShakeDetection();
    }
    
    this.isPermissionGranted = true;
    this.showDebug(`✅ センサー許可フラグ設定: ${this.isPermissionGranted}`);
    this.showDebug(`✅ ===== センサー開始処理完了 =====`);
}


    // センサートラブルシューティング用メソッド
troubleshootSensors() {
    this.showDebug(`🔧 ===== センサートラブルシューティング =====`);
    
    // 手動でテストイベントを作成
    this.showDebug(`🧪 手動テストイベント作成...`);
    
    const testEvent = {
        alpha: 45,
        beta: 10,
        gamma: 5,
        webkitCompassHeading: 45,
        absolute: true
    };
    
    //this.showDebug(`📤 テストイベント送信:`);
    this.showDebug(`  - alpha: ${testEvent.alpha}`);
    this.showDebug(`  - webkitCompassHeading: ${testEvent.webkitCompassHeading}`);
    
    // テストイベントでhandleOrientationを呼び出し
    this.handleOrientation(testEvent);
    
    this.showDebug(`📊 テスト結果確認:`);
    this.showDebug(`  - heading更新後: ${this.heading}°`);
    this.showDebug(`  - 画面表示: ${document.getElementById('heading').textContent}`);
    
    if (this.heading !== 0) {
        this.showDebug(`✅ handleOrientation処理は正常動作`);
        this.showDebug(`❌ 実際のデバイスイベントが発生していない`);
        this.showDebug(`💡 可能な原因:`);
        this.showDebug(`   - ブラウザがセンサーアクセスをブロック`);
        this.showDebug(`   - HTTPS接続が必要`);
        this.showDebug(`   - デバイスがセンサーをサポートしていない`);
    } else {
        this.showDebug(`❌ handleOrientation処理に問題あり`);
    }
    
    this.showDebug(`✅ ===== トラブルシューティング完了 =====`);
}
  
    
  // 【ステップ4】既存のhandleOrientationメソッドを以下で完全置き換えしてください

handleOrientation(event) {
    // 【追加】デバッグ出力を制限（1秒に1回程度）でちらつき防止
    const shouldDebug = !this.lastOrientationDebug || (Date.now() - this.lastOrientationDebug) > 1000;
    
    if (shouldDebug) {
        this.showDebug(`📡 handleOrientation呼び出し！`);
        //this.showDebug(`📊 イベントデータ: alpha=${event.alpha}, beta=${event.beta}`);
        this.lastOrientationDebug = Date.now();
    }
    
    // 権限チェック前にログ（デバッグ頻度制御あり）
    if (shouldDebug) {
        this.showDebug(`🔐 権限チェック: isPermissionGranted = ${this.isPermissionGranted}`);
    }
    
    if (!this.isPermissionGranted) {
        if (shouldDebug) this.showDebug('❌ センサー権限なし - 処理停止');
        return;
    }
    
    let newHeading = 0;
    
    // iOS方式の確認
    if (event.webkitCompassHeading !== undefined) {
        newHeading = event.webkitCompassHeading;
        if (shouldDebug) this.showDebug(`🍎 iOS方式採用: webkitCompassHeading = ${newHeading}°`);
    }
    // Android方式の確認
    else if (event.alpha !== null) {
        newHeading = 360 - event.alpha;
        if (newHeading >= 360) newHeading -= 360;
        if (newHeading < 0) newHeading += 360;
        if (shouldDebug) this.showDebug(`🤖 Android方式採用: alpha = ${event.alpha}° → heading = ${newHeading}°`);
    }
    else {
        if (shouldDebug) this.showDebug(`❌ 有効なセンサーデータなし`);
    }
    
    const oldHeading = this.heading;
    this.heading = newHeading;
    
    if (shouldDebug) {
        this.showDebug(`📊 heading更新: ${oldHeading}° → ${this.heading}°`);
    }
    
    const newTilt = event.beta || 0;
    const currentTime = Date.now();
    const deltaTime = Math.max((currentTime - this.lastTime) / 1000, 0.001);
    const deltaTilt = newTilt - this.lastTilt;
    this.tiltSpeed = Math.abs(deltaTilt) / deltaTime;
    
    this.tilt = newTilt;
    this.lastTilt = newTilt;
    this.lastTime = currentTime;
    
    if (shouldDebug) {
        this.showDebug(`✅ updateDisplay呼び出し`);
    }
    this.updateDisplay();
}
    

    
    handleAbsoluteOrientation(event) {
        if (event.absolute && event.alpha !== null) {
            this.absoluteHeading = event.alpha;
            this.heading = 360 - this.absoluteHeading;
            if (this.heading >= 360) this.heading -= 360;
            if (this.heading < 0) this.heading += 360;
        }
    }
    
    handleMotion(event) {
    if (!this.isDetectingShake) return;
    
    const acceleration = event.acceleration || event.accelerationIncludingGravity;
    if (!acceleration) return;
    
    // 【修正】より正確な加速度計算（重力を除去）
    let totalAcceleration;
    if (event.acceleration) {
        // 重力除去済みの加速度データがある場合
        totalAcceleration = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) + 
            Math.pow(acceleration.y || 0, 2) + 
            Math.pow(acceleration.z || 0, 2)
        );
    } else {
        // 重力込みデータから推定重力を差し引く
        const x = acceleration.x || 0;
        const y = acceleration.y || 0;
        const z = acceleration.z || 0;
        
        // 重力の影響を減らす（通常重力は約9.8）
        const gravityCompensatedZ = Math.abs(z) > 9 ? z - Math.sign(z) * 9.8 : z;
        
        totalAcceleration = Math.sqrt(x * x + y * y + gravityCompensatedZ * gravityCompensatedZ);
    }
    
    const currentTime = Date.now();
    this.accelerationData.push({
        value: totalAcceleration,
        timestamp: currentTime
    });
    
    // Keep only recent data (last 1 second)
    this.accelerationData = this.accelerationData.filter(
        data => currentTime - data.timestamp <= 1000
    );
    
    if (totalAcceleration > this.maxAcceleration) {
        this.maxAcceleration = totalAcceleration;
    }
    
    // 【修正】パワーメーター表示の調整
    const powerLevel = Math.min((totalAcceleration / 15) * 100, 100); // 20から15に変更
    document.getElementById('powerFill').style.height = powerLevel + '%';
    document.getElementById('speed').textContent = `${Math.round(totalAcceleration * 10)/10}`;
    
    // 【修正】投球検出の閾値調整
    if (totalAcceleration > this.shakeThreshold && this.maxAcceleration > this.shakeThreshold) {
        console.log('🎯 投球検出！最大加速度:', this.maxAcceleration);
        this.startThrowWithShake();
    }
}
    
    setupFallbackShakeDetection() {
        console.log('🔧 フォールバック振り検出を設定');
        let tapCount = 0;
        let lastTapTime = 0;
        
        const handleTap = (e) => {
            if (!this.isDetectingShake) return;
            
            console.log('👆 タップ検出');
            const currentTime = Date.now();
            if (currentTime - lastTapTime < 500) {
                tapCount++;
                console.log(`タップ回数: ${tapCount}`);
                if (tapCount >= 3) {
                    this.maxAcceleration = 25;
                    console.log('🎯 フォールバック投球発動！');
                    this.startThrowWithShake();
                    tapCount = 0;
                }
            } else {
                tapCount = 1;
            }
            lastTapTime = currentTime;
        };
        
        document.addEventListener('touchstart', handleTap);
        document.addEventListener('click', handleTap);
        
        // 画面を長押しした場合も投球発動
        let longPressTimer = null;
        document.addEventListener('touchstart', (e) => {
            if (!this.isDetectingShake) return;
            longPressTimer = setTimeout(() => {
                this.maxAcceleration = 20;
                console.log('⏱️ 長押し投球発動！');
                this.startThrowWithShake();
            }, 1500);
        });
        
        document.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
    }
    
    // 【ステップ3】既存のupdateDisplayメソッドを以下で完全置き換えしてください

updateDisplay() {
    // 【追加】表示更新頻度制御（ちらつき防止）
    if (!this.lastDisplayUpdate) {
        this.lastDisplayUpdate = 0;
    }
    
    const now = Date.now();
    if (now - this.lastDisplayUpdate < 50) { // 50ms間隔に制限
        return;
    }
    this.lastDisplayUpdate = now;
    
    document.getElementById('heading').textContent = Math.round(this.heading) + '°';
    document.getElementById('compass').textContent = this.getCompassDirection(this.heading);
    document.getElementById('tilt').textContent = Math.round(this.tilt) + '°';
    
    // Update compass needle
    this.compassNeedle.style.transform = `rotate(${this.heading}deg)`;
    
    // スタート地点からの距離を計算して表示
    if (!this.isBallMoving) {
        this.totalDistance = this.calculateDistance(
            this.startPosition.lat, this.startPosition.lng,
            this.ballPosition.lat, this.ballPosition.lng
        );
        document.getElementById('distance').textContent = Math.round(this.totalDistance) + 'm';
    }
    
    // Map rotation management
    const DEAD_ZONE_START = 350;
    const DEAD_ZONE_END = 10;
    
    const isHeadingInDeadZone = (this.heading >= DEAD_ZONE_START && this.heading < 360) || 
                                (this.heading >= 0 && this.heading < DEAD_ZONE_END);

    if (!this.isActive && !this.isCountdownActive && !this.isBallMoving && this.isMapReady && !isHeadingInDeadZone) {
        this.mapElement.style.transform = `rotate(${-this.heading}deg)`;
    }
    
    this.updateCoordinatesDisplay();
}
    
        

    
    getCompassDirection(heading) {
        const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    updateCoordinatesDisplay() {
        const lat = this.ballPosition.lat.toFixed(6);
        const lng = this.ballPosition.lng.toFixed(6);
        document.getElementById('coordinates').textContent = `${lat}, ${lng}`;
    }
    
    setupComplete() {
        this.updateStatus('🎯 投球準備完了！スタートボタンを押してください');
        this.updateCoordinatesDisplay();
        
        // Initialize canvas
        this.initCanvas();
        
        if (this.map) {
            try {
                this.map.setCenter(this.currentPosition);
                setTimeout(() => {
                    if (window.google && google.maps && google.maps.event) {
                        google.maps.event.trigger(this.map, 'resize');
                        this.map.setCenter(this.currentPosition);
                    }
                }, 100);
            } catch (e) {
                console.warn('⚠️ Map setup failed:', e);
            }
        }
        
        const startBtn = document.getElementById('startBtn');
        startBtn.textContent = '🚀 スタート';
        startBtn.disabled = false;
        startBtn.classList.add('countdown-ready');
        startBtn.onclick = () => this.startCountdown();
    }
    
// Canvas初期化（エラーハンドリング強化）
initCanvas() {
    if (!this.gameCanvas) {
        console.error('❌ Game canvas element not found');
        return false;
    }
    
    const container = this.gameCanvas.parentElement;
    if (!container) {
        console.error('❌ Canvas container not found');
        return false;
    }
    
    // 【修正】初期サイズは基本サイズで設定
    this.canvasWidth = container.clientWidth;
    this.canvasHeight = container.clientHeight;
    
    if (this.canvasWidth <= 0 || this.canvasHeight <= 0) {
        console.error('❌ Invalid canvas dimensions:', this.canvasWidth, 'x', this.canvasHeight);
        return false;
    }
    
    //キャンバスサイズを画面サイズに設定
    this.gameCanvas.width = this.canvasWidth;
    this.gameCanvas.height = this.canvasHeight;
    
    try {
        this.ctx = this.gameCanvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Canvas context is null');
        }
    } catch (error) {
        console.error('❌ Failed to get canvas context:', error);
        return false;
    }
    
    this.ballCanvasX = this.canvasWidth / 2;
    this.ballCanvasY = this.canvasHeight / 2;
    
    this.loadBallImage();
    
    console.log('✅ Canvas initialized successfully:', this.canvasWidth, 'x', this.canvasHeight);
    return true;
}


    // ボール画像読み込み（改善版）
    loadBallImage() {
        console.log('🏀 ボール画像読み込み開始');
        this.ballImage = new Image();

        this.ballImage.onload = () => {
            console.log('✅ Ball image loaded successfully');
            this.isBallImageReady = true;
            this.updatePreparationStatus();
        };
        this.ballImage.onerror = () => {
            console.warn('⚠️ Ball image failed to load, creating fallback');
            this.createFallbackBallImage();
            this.ballImage.src = 'ball.png';// フォールバック
        
        // ball.pngも失敗した場合のフォールバック
            this.ballImage.onerror = () => {
                console.warn('⚠️ ball.png also failed, creating fallback');
                this.createFallbackBallImage();
            };
        };

        // 修正: ball.gif を最初に試行（この行を変更）
        this.ballImage.src = 'ball.gif';  // 元: 'ball.png'
    }
    
    // フォールバックボール画像生成
    createFallbackBallImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        
        const centerX = 60;
        const centerY = 60;
        const radius = 55;
        
        // バスケットボール風のボール
        const gradient = ctx.createRadialGradient(
            centerX - 20, centerY - 20, 0,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, '#ff8a65');
        gradient.addColorStop(0.7, '#ff5722');
        gradient.addColorStop(1, '#d84315');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // バスケットボールのライン
        ctx.strokeStyle = '#8d4004';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.7, -Math.PI, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI);
        ctx.stroke();
        
        // ハイライト
        ctx.fillStyle = '#ffccbc';
        ctx.beginPath();
        ctx.arc(centerX - 15, centerY - 15, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        this.ballImage = new Image();
        this.ballImage.onload = () => {
            console.log('✅ Fallback ball image created');
            this.isBallImageReady = true;
            this.updatePreparationStatus();
        };
        this.ballImage.src = canvas.toDataURL();
    }
    
    fallbackSetup() {
        setTimeout(() => {
            this.isMapReady = true;
            this.isMapFullyLoaded = true;
            this.isPermissionGranted = true;
            this.setupComplete();
        }, 2000);
    }
    
    async startCountdown() {
        if (this.isCountdownActive || this.isActive) return;
        
        this.playSound('start');
        
        this.isCountdownActive = true;
        const startBtn = document.getElementById('startBtn');
        startBtn.disabled = true;
        startBtn.classList.remove('countdown-ready');
        
        let count = 3;
        this.showCountdown(count);
        
        this.countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                this.showCountdown(count);
            } else {
                this.showCountdown('投げて！');
                setTimeout(() => {
                    this.hideCountdown();
                    this.enableThrowDetection();
                }, 1000);
                clearInterval(this.countdownTimer);
            }
        }, 1000);
    }
    
    showCountdown(text) {
        this.hideCountdown();
        
        this.countdownElement = document.createElement('div');
        this.countdownElement.className = 'countdown';
        this.countdownElement.textContent = text;
        document.body.appendChild(this.countdownElement);
    }
    
    hideCountdown() {
        if (this.countdownElement && this.countdownElement.parentNode) {
            this.countdownElement.parentNode.removeChild(this.countdownElement);
            this.countdownElement = null;
        }
    }
    
    enableThrowDetection() {
        this.isCountdownActive = false;
        this.isDetectingShake = true;
        this.accelerationData = [];
        this.maxAcceleration = 0;
        
        document.getElementById('powerMeter').style.display = 'block';
        
        this.updateStatus('📱 スマホを振って投球してください！（3回タップまたは長押しでも可能）');
        
        // 15秒でタイムアウト
        setTimeout(() => {
            if (!this.isActive && this.isDetectingShake) {
                this.isDetectingShake = false;
                document.getElementById('powerMeter').style.display = 'none';
                this.updateStatus('⏰ タイムアウトしました。再度お試しください。');
                this.reset();
            }
        }, 15000);
    }
    
    startThrowWithShake() {
    if (this.isActive || !this.isDetectingShake) return;
    
    console.log('🎯 投球時heading:', this.heading, '度');
    this.showDebug(`⏰ 設定時刻: ${new Date().toLocaleTimeString()}`);
    
    // 現在のコンパス状態を詳細に記録
    this.showDebug(`📱 現在のコンパス状態:`);
    this.showDebug(`  - 画面表示heading: ${document.getElementById('heading').textContent}`);
    this.showDebug(`  - 画面表示compass: ${document.getElementById('compass').textContent}`);
    this.showDebug(`  - this.heading値: ${this.heading}°`);
    this.showDebug(`  - compassNeedle回転: ${this.compassNeedle.style.transform}`);
    
    console.log('🎯 投球準備処理開始');
    this.isDetectingShake = false;
    document.getElementById('powerMeter').style.display = 'none';
    
    // より細かい段階分けで現実的な飛距離に
    let throwPower;
    if (this.maxAcceleration <= 10) {
        throwPower = 100 + (this.maxAcceleration - 8) * 100;
    } else if (this.maxAcceleration <= 15) {
        throwPower = 300 + (this.maxAcceleration - 10) * 60;
    } else if (this.maxAcceleration <= 20) {
        throwPower = 600 + (this.maxAcceleration - 15) * 80;
    } else if (this.maxAcceleration <= 30) {
        throwPower = 1000 + (this.maxAcceleration - 20) * 100;
    } else {
        throwPower = Math.min(2000, 1500 + (this.maxAcceleration - 25) * 100);
    }
    this.throwPower = Math.max(100, Math.round(throwPower));
    
    // 【重要】投球角度の設定
    this.throwAngle = this.heading;
    
    this.showDebug(`🎯 投球角度設定:`);
    this.showDebug(`  - this.heading → this.throwAngle: ${this.heading}° → ${this.throwAngle}°`);
    this.showDebug(`  - 方向名: ${this.getCompassDirection(this.throwAngle)}`);
    this.showDebug(`  - 投球パワー: ${this.throwPower}m`);
    this.showDebug(`✅ ===== 投球角度設定完了 =====`);
    
    console.log(`投球検出! 最大加速度: ${this.maxAcceleration.toFixed(2)}, パワー: ${this.throwPower}m, 方向: ${this.throwAngle}°`);
    
    this.ballElement.classList.add('throwing');
    this.ballTrailPoints = [];
    this.clearTrails();
    this.ballPosition = { ...this.startPosition };
    
    this.showResourcePreparation();
}
    
    showResourcePreparation() {
        this.preparationOverlay = document.createElement('div');
        this.preparationOverlay.className = 'preparation-overlay';
        this.preparationOverlay.innerHTML = `
            <div>
                <div style="font-size: 32px; margin-bottom: 20px;">🏀</div>
                <div style="font-size: 24px; margin-bottom: 20px;">投球準備中...</div>
                
                <div class="preparation-status">
                    <div class="status-item status-loading" id="statusAudio">
                        🔊 効果音: 準備中...
                    </div>
                    <div class="status-item status-loading" id="statusImages">
                        🛰️ 航空写真: 準備中...
                    </div>
                    <div class="status-item status-loading" id="statusBall">
                        🏀 ボール画像: 準備中...
                    </div>
                </div>
                
                <button class="kick-button" id="kickButton" disabled>
                    準備中...
                </button>
            </div>
        `;
        document.body.appendChild(this.preparationOverlay);
        
        this.prepareResources();
    }
    
    async prepareResources() {
        console.log('🚀 リソース準備開始');

        // 修正: 状態をリセット（この3行を追加）
        this.isAudioReady = false;
        this.isAerialImagesReady = false;
        this.isBallImageReady = false;
    
        
        // 並行してリソースを準備
        this.prepareAudio();
        this.prepareAerialImages();
        this.loadBallImage();
    }
    
    // 音声準備（改善版）
    prepareAudio() {
        console.log('🔊 効果音準備開始');
        
        const kickAudio = this.sounds.kick;
        // まず現在の状態をチェック
        if (kickAudio.readyState >= 2) {
            console.log('✅ 効果音は既に準備済み');
            this.isAudioReady = true;
            this.updatePreparationStatus();
            return;
        }

        const onCanPlay = () => {
            console.log('✅ 効果音準備完了（イベント）');
            this.isAudioReady = true;
            this.updatePreparationStatus();
            cleanup();
        };
            const onError = (e) => {
                console.warn('⚠️ 効果音読み込み失敗、新しいインスタンスで再試行', e);
                // 新しいAudioインスタンスを作成
                const newAudio = new Audio('kick.mp3');
                newAudio.volume = 0.8;
                newAudio.preload = 'auto';
                this.sounds.kick = newAudio;
        
                newAudio.onload = () => {
                    console.log('✅ 新しい効果音インスタンス準備完了');
                    this.isAudioReady = true;
                    this.updatePreparationStatus();
                };
        
                newAudio.onerror = () => {
                    console.log('⚠️ 効果音準備失敗、フォールバックで続行');
                    this.isAudioReady = true;
                    this.updatePreparationStatus();
                };
        
                cleanup();
                };

            const cleanup = () => {
            kickAudio.removeEventListener('canplaythrough', onCanPlay);
            kickAudio.removeEventListener('error', onError);
            };
    
            kickAudio.addEventListener('canplaythrough', onCanPlay, { once: true });
            kickAudio.addEventListener('error', onError, { once: true });
    
            try {
                kickAudio.load();
            } catch (e) {
            console.warn('Audio load failed:', e);
            onError(e);
        }


        // タイムアウト設定を短縮
        setTimeout(() => {
            if (!this.isAudioReady) {
                console.warn('⚠️ 効果音準備タイムアウト、強制的に準備完了とする');
                this.isAudioReady = true;
                this.updatePreparationStatus();
                cleanup();
            }
        }, 2000);
    }
        
    
    updatePreparationStatus() {
        if (!this.preparationOverlay) return;
        
        const statusAudio = this.preparationOverlay.querySelector('#statusAudio');
        const statusImages = this.preparationOverlay.querySelector('#statusImages');
        const statusBall = this.preparationOverlay.querySelector('#statusBall');
        const kickButton = this.preparationOverlay.querySelector('#kickButton');
        
        if (this.isAudioReady) {
            statusAudio.className = 'status-item status-ready';
            statusAudio.textContent = '🔊 効果音: 準備完了 ✅';
        }
        
        if (this.isAerialImagesReady) {
            statusImages.className = 'status-item status-ready';
            statusImages.textContent = `🛰️ 航空写真: 準備完了 (${this.aerialImages.length}枚) ✅`;
        }
        
        if (this.isBallImageReady) {
            statusBall.className = 'status-item status-ready';
            statusBall.textContent = '🏀 ボール画像: 準備完了 ✅';
        }
        
        if (this.isAudioReady && this.isAerialImagesReady && this.isBallImageReady) {
            kickButton.disabled = false;
            kickButton.textContent = '🚀 KICK!';
            kickButton.onclick = () => {
                this.hideResourcePreparation();
                 // ここでボール移動を開始
                this.startBallMovement();
            };
            
            console.log('🎯 全リソース準備完了！Kickボタン有効化');
        }
    }
    
    hideResourcePreparation() {
        if (this.preparationOverlay && this.preparationOverlay.parentNode) {
            this.preparationOverlay.parentNode.removeChild(this.preparationOverlay);
            this.preparationOverlay = null;
        }
    }

    // 【重要修正】投球パワーに応じたズームレベルと画像サイズを計算
calculateOptimalImageParams() {
    const powerMeters = this.throwPower;
    this.showDebug(`🎯 投球パワー: ${powerMeters}m`);
    
    let zoom, imageSize;

    // 【修正】キャンバスサイズに応じて画像サイズを調整
    const canvasScale = Math.max(this.canvasWidth / 800, this.canvasHeight / 600);
    
    // パワーに応じて適切なズームレベルを設定（画像サイズを小さく調整）
    if (powerMeters <= 200) {
        zoom = 18;  // 近距離用：建物詳細レベル
        imageSize = 1024;  // 3072 → 1024に縮小
    } else if (powerMeters <= 500) {
        zoom = 17;  // 中距離用：街区レベル
        imageSize = 1536;  // 4096 → 1536に縮小
    } else if (powerMeters <= 1000) {
        zoom = 16;  // 長距離用：地区レベル
        imageSize = 2048;  // 5120 → 2048に縮小
    } else if (powerMeters <= 2000) {
        zoom = 15;  // 超長距離用：市区レベル
        imageSize = 2560;  // 6144 → 2560に縮小
    } else {
        zoom = 14;  // 極長距離用：広域レベル
        imageSize = 3072;  // 8192 → 3072に縮小
    }
    
    this.showDebug(`📐 選択パラメータ: zoom=${zoom}, imageSize=${imageSize}px`);
    
    return { zoom, imageSize };
}


// ステップ1: prepareAerialImages() メソッドの回転処理部分を以下で置き換えてください

async prepareAerialImages() {
    this.showDebug('🛰️ 地理院地図航空写真準備開始');
    
    try {
        this.showDebug(`📍 位置: ${this.startPosition.lat.toFixed(6)}, ${this.startPosition.lng.toFixed(6)}`);
        this.showDebug(`🧭 投球角度: ${this.throwAngle}度`);
        
        // 投球パワーに応じて最適なパラメータを計算
        const { zoom, imageSize } = this.calculateOptimalImageParams();

        // 地理院地図の航空写真を使用
        const aerialImage = await this.createGSIAerialImage(
            this.startPosition.lat, 
            this.startPosition.lng, 
            zoom,
            imageSize
        );
        
        this.showDebug(`✅ 地理院地図航空写真取得成功: ${aerialImage.naturalWidth}x${aerialImage.naturalHeight}`);
        
        // 【重要修正】回転処理を確実に同期待機
        this.showDebug(`🔄 画像回転開始: ${this.throwAngle}度`);
        
        // 回転処理実行
        const rotatedImage = this.rotateImageForThrow(aerialImage, this.throwAngle);
        
        // 【新規追加】回転完了を確実に待機する Promise
        const finalRotatedImage = await this.waitForImageRotationComplete(rotatedImage);
        
        this.showDebug(`✅ 回転処理完全完了`);
        this.showDebug(`📦 最終画像状態:`);
        this.showDebug(`  - サイズ: ${finalRotatedImage.naturalWidth}x${finalRotatedImage.naturalHeight}`);
        this.showDebug(`  - complete: ${finalRotatedImage.complete}`);
        this.showDebug(`  - 回転角度: ${this.throwAngle}度`);
        
        // 配列に格納（回転済み画像を確実に使用）
        this.aerialImages = [{
            image: finalRotatedImage,  // ← 確実に回転完了した画像
            position: this.startPosition,
            distance: 0,
            index: 0,
            zoom: zoom,
            imageSize: imageSize,
            appliedRotation: this.throwAngle  // ← デバッグ用回転角度記録
        }];

        this.showDebug('✅ 地理院地図航空写真準備完了！');
        this.debugAerialImageState();
        
        this.isAerialImagesReady = true;
        this.updatePreparationStatus();

    } catch (error) {
        this.showDetailedError('地理院地図航空写真準備', error);
        
        // エラー時は基本フォールバック画像を使用
        this.showDebug('🎨 基本フォールバック画像生成');
        const fallbackImage = this.createBasicFallbackImage();
        
        this.aerialImages = [{
            image: fallbackImage,
            position: this.startPosition,
            distance: 0,
            index: 0
        }];
        
        this.showDebug('✅ フォールバック画像準備完了');
        this.isAerialImagesReady = true;
        this.updatePreparationStatus();
    }
}

// 【新規追加】回転画像の完了を確実に待機するメソッド
async waitForImageRotationComplete(rotatedImage) {
    this.showDebug('⏳ 回転画像完了待機開始...');
    
    return new Promise((resolve, reject) => {
        // すでに完了している場合
        if (rotatedImage.complete && rotatedImage.naturalWidth > 0) {
            this.showDebug('✅ 回転画像は既に完了済み');
            resolve(rotatedImage);
            return;
        }
        
        // 完了を待つ
        const onLoad = () => {
            this.showDebug(`✅ 回転画像読み込み完了: ${rotatedImage.naturalWidth}x${rotatedImage.naturalHeight}`);
            cleanup();
            resolve(rotatedImage);
        };
        
        const onError = (e) => {
            this.showDebug(`❌ 回転画像読み込みエラー: ${e}`);
            cleanup();
            reject(new Error('回転画像読み込み失敗'));
        };
        
        const onTimeout = () => {
            this.showDebug('⏰ 回転画像読み込みタイムアウト');
            cleanup();
            // タイムアウトでも画像を返す（部分的に使用可能な可能性）
            resolve(rotatedImage);
        };
        
        const cleanup = () => {
            rotatedImage.removeEventListener('load', onLoad);
            rotatedImage.removeEventListener('error', onError);
            clearTimeout(timeoutId);
        };
        
        // イベントリスナー設定
        rotatedImage.addEventListener('load', onLoad, { once: true });
        rotatedImage.addEventListener('error', onError, { once: true });
        
        // 5秒タイムアウト
        const timeoutId = setTimeout(onTimeout, 5000);
        
        this.showDebug('📥 回転画像イベントリスナー設定完了');
    });
}






// 地理院地図航空写真作成メソッド
async createGSIAerialImage(lat, lng, zoom, size) {
    this.showDebug(`🗾 地理院地図タイル計算中: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}, zoom=${zoom}`);
    
    // タイル座標計算
    const centerX = this.lonToTileX(lng, zoom);
    const centerY = this.latToTileY(lat, zoom);
    
    this.showDebug(`📐 タイル中心座標: X=${centerX.toFixed(3)}, Y=${centerY.toFixed(3)}`);
    
    // 必要なタイル数計算 (size=1024なら4x4タイル)
    const tilesNeeded = Math.ceil(size / 256);
    const startX = Math.floor(centerX - tilesNeeded / 2);
    const startY = Math.floor(centerY - tilesNeeded / 2);
    
    this.showDebug(`📦 タイル範囲: X=${startX}~${startX + tilesNeeded}, Y=${startY}~${startY + tilesNeeded} (${tilesNeeded}x${tilesNeeded})`);
    
    // Canvas作成
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        throw new Error('Canvas context作成失敗');
    }
    
    // 背景を薄いグレーで塗りつぶし（タイル境界確認用）
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, size, size);
    
    const promises = [];
    let loadedTiles = 0;
    let totalTiles = (tilesNeeded + 1) * (tilesNeeded + 1);
    
    this.showDebug(`📥 ${totalTiles}個のタイル読み込み開始...`);
    
    // 複数タイルを並行ダウンロード
    for (let x = 0; x < tilesNeeded + 1; x++) {
        for (let y = 0; y < tilesNeeded + 1; y++) {
            const tileX = startX + x;
            const tileY = startY + y;
            
            const promise = this.loadGSITile(tileX, tileY, zoom).then(tileImg => {
                if (tileImg) {
                    const drawX = x * 256 - ((centerX - startX) * 256 - size / 2);
                    const drawY = y * 256 - ((centerY - startY) * 256 - size / 2);
                    ctx.drawImage(tileImg, drawX, drawY, 256, 256);
                    loadedTiles++;
                    this.showDebug(`✅ タイル${loadedTiles}/${totalTiles}: (${tileX},${tileY}) → (${Math.round(drawX)},${Math.round(drawY)})`);
                } else {
                    this.showDebug(`⚠️ タイル読み込み失敗: (${tileX},${tileY})`);
                }
            }).catch(e => {
                this.showDebug(`❌ タイル(${tileX},${tileY})エラー: ${e.message}`);
            });
            
            promises.push(promise);
        }
    }
    
    // 全タイル読み込み完了を待つ
    await Promise.all(promises);
    
    this.showDebug(`🎯 タイル読み込み完了: ${loadedTiles}/${totalTiles}個成功`);
    
    // Canvasから画像を作成
    const finalImage = new Image();
    finalImage.src = canvas.toDataURL('image/jpeg', 0.9);
    
    return new Promise((resolve, reject) => {
        finalImage.onload = () => {
            this.showDebug(`✅ 地理院地図合成画像作成完了: ${finalImage.naturalWidth}x${finalImage.naturalHeight}`);
            resolve(finalImage);
        };
        finalImage.onerror = (e) => {
            this.showDebug(`❌ 合成画像作成失敗: ${e}`);
            reject(new Error('合成画像作成失敗'));
        };
        
        // タイムアウト
        setTimeout(() => {
            this.showDebug('⏰ 合成画像作成タイムアウト');
            reject(new Error('合成画像作成タイムアウト'));
        }, 5000);
    });
}

// 手順3: createGSIAerialImageメソッドの直後に以下のメソッドを追加してください

// 地理院地図タイル読み込み
loadGSITile(x, y, z) {
    return new Promise((resolve) => {
        const url = `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`;
        
        const img = new Image();
        // CORS設定（地理院地図は許可されている）
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            // 画像が正常に読み込まれた場合
            resolve(img);
        };
        
        img.onerror = (e) => {
            // 海域など画像が存在しない場合はnullを返す
            resolve(null);
        };
        
        // タイムアウト設定（3秒）
        setTimeout(() => {
            resolve(null);
        }, 3000);
        
        img.src = url;
    });
}


// 手順4: loadGSITileメソッドの直後に以下の2つのメソッドを追加してください

// 経度→タイルX座標変換
lonToTileX(lon, zoom) {
    return (lon + 180) / 360 * Math.pow(2, zoom);
}

// 緯度→タイルY座標変換  
latToTileY(lat, zoom) {
    return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
}


// 【重要】画像回転が実際に実行されているかの確認

rotateImageForThrow(originalImg, throwAngle) {
    this.showDebug(`🔄 ===== 画像回転メソッド呼び出し =====`);
    this.showDebug(`📊 受信パラメータ:`);
    this.showDebug(`  - throwAngle: ${throwAngle}°`);
    this.showDebug(`  - 画像タイプ: ${originalImg.constructor.name}`);
    this.showDebug(`  - 画像サイズ: ${originalImg.width}x${originalImg.height}`);
    this.showDebug(`  - 画像src: ${originalImg.src ? originalImg.src.substring(0, 30) + '...' : 'データURL'}`);
    
    // 回転角度の詳細計算
    const correctedAngle = -(throwAngle - 90);
    this.showDebug(`🧮 回転角度計算:`);
    this.showDebug(`  - 入力角度: ${throwAngle}°`);
    this.showDebug(`  - 計算式: -(${throwAngle} - 90) = ${correctedAngle}°`);
    
    // 期待される結果を明示
    const directionMap = {
        0: { corrected: -90, result: "北が上向き" },
        90: { corrected: 0, result: "東が上向き" },
        180: { corrected: 90, result: "南が上向き" },
        270: { corrected: 180, result: "西が上向き" }
    };
    
    const expected = directionMap[throwAngle] || { corrected: correctedAngle, result: "計算された方向" };
    this.showDebug(`  - 期待結果: ${expected.result}`);
    this.showDebug(`  - 計算値: ${correctedAngle}° (期待値: ${expected.corrected}°)`);
    
    if (Math.abs(correctedAngle - expected.corrected) < 1) {
        this.showDebug(`  ✅ 角度計算正常`);
    } else {
        this.showDebug(`  ⚠️ 角度計算に差異あり`);
    }
    
    // 実際に画像が回転されているかテスト
    const canvas = document.createElement('canvas');
    const diagonal = Math.sqrt(originalImg.width * originalImg.width + originalImg.height * originalImg.height);
    canvas.width = Math.ceil(diagonal);
    canvas.height = Math.ceil(diagonal);
    
    this.showDebug(`🖼️ キャンバス作成:`);
    this.showDebug(`  - 元画像対角線: ${diagonal.toFixed(1)}px`);
    this.showDebug(`  - キャンバスサイズ: ${canvas.width}x${canvas.height}`);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        this.showDebug(`❌ キャンバスコンテキスト取得失敗`);
        return originalImg;
    }
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    try {
        // 回転前の状態を記録
        ctx.save();
        
        // 【重要】背景色で回転確認
        ctx.fillStyle = throwAngle === 0 ? '#ffcccc' :   // 北: 薄い赤
                        throwAngle === 90 ? '#ccffcc' :   // 東: 薄い緑  
                        throwAngle === 180 ? '#ccccff' :  // 南: 薄い青
                        throwAngle === 270 ? '#ffffcc' :  // 西: 薄い黄
                        '#e0e0e0';                        // その他: グレー
        
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.showDebug(`🎨 背景色設定: ${ctx.fillStyle} (方向識別用)`);
        
        // 中心に移動
        ctx.translate(centerX, centerY);
        this.showDebug(`📐 中心移動: translate(${centerX}, ${centerY})`);
        
        // 回転実行
        const radians = (correctedAngle * Math.PI) / 180;
        ctx.rotate(radians);
        this.showDebug(`🔄 回転実行: rotate(${radians.toFixed(4)} radians = ${correctedAngle}°)`);
        
        // 画像描画
        const drawX = -originalImg.width / 2;
        const drawY = -originalImg.height / 2;
        ctx.drawImage(originalImg, drawX, drawY, originalImg.width, originalImg.height);
        this.showDebug(`🖼️ 画像描画: (${drawX}, ${drawY}) サイズ ${originalImg.width}x${originalImg.height}`);
        
        // 【追加】回転確認用のマーカー（方向矢印）
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.fillStyle = '#ff0000';
        
        // 上向き矢印（投球方向表示）
        ctx.beginPath();
        ctx.moveTo(0, -60);
        ctx.lineTo(0, -20);
        ctx.moveTo(-15, -45);
        ctx.lineTo(0, -60);
        ctx.lineTo(15, -45);
        ctx.stroke();
        
        // 矢印の根元に方向文字
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${throwAngle}°`, 0, -10);
        
        this.showDebug(`🎯 方向マーカー描画完了 (赤矢印 + ${throwAngle}°)`);
        
        ctx.restore();
        
        // 結果画像生成
        const dataURL = canvas.toDataURL('image/png', 0.9);
        this.showDebug(`📦 データURL生成:`);
        this.showDebug(`  - 画像形式: PNG`);
        this.showDebug(`  - データサイズ: ${Math.round(dataURL.length / 1024)}KB`);
        
        const rotatedImg = new Image();
        rotatedImg.onload = () => {
            this.showDebug(`✅ 回転画像作成完了:`);
            this.showDebug(`  - 最終サイズ: ${rotatedImg.naturalWidth}x${rotatedImg.naturalHeight}`);
            this.showDebug(`✅ ===== 画像回転メソッド完了 =====`);
        };
        
        rotatedImg.onerror = (e) => {
            this.showDebug(`❌ 回転画像作成失敗: ${e}`);
        };
        
        rotatedImg.src = dataURL;
        return rotatedImg;
        
    } catch (error) {
        ctx.restore();
        this.showDebug(`❌ 画像回転エラー: ${error.message}`);
        this.showDebug(`  → 元画像を返します`);
        return originalImg;
    }
}


createDirectionalAerialImage(throwAngle) {
    console.log(`🎨 方向性フォールバック画像生成（${throwAngle}度）`);
    
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const directionRad = (throwAngle * Math.PI) / 180;
    
    // 基本背景グラデーション
    const gradient = ctx.createLinearGradient(0, 0, Math.cos(directionRad) * 1024, Math.sin(directionRad) * 1024);
    gradient.addColorStop(0, '#2d5016');
    gradient.addColorStop(0.3, '#4a7c3a');
    gradient.addColorStop(0.6, '#8FBC8F');
    gradient.addColorStop(1, '#6b8e23');
    
    ctx.fillStyle = gradient;

    ctx.fillRect(0, 0, 1024, 1024);
    
    // 【追加】投球方向に沿った道路風パターン
ctx.strokeStyle = 'rgba(139, 69, 19, 0.4)';
ctx.lineWidth = 8;
for (let i = 0; i < 15; i++) {
    const offsetAngle = directionRad + (i - 7) * 0.3;  // 投球方向を基準に放射状
    const startX = 512 + Math.cos(offsetAngle + Math.PI) * 400;  // 中心から外側へ
    const startY = 512 + Math.sin(offsetAngle + Math.PI) * 400;
    const endX = 512 + Math.cos(offsetAngle) * 400;
    const endY = 512 + Math.sin(offsetAngle) * 400;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}

// 【追加】建物風の矩形
ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
for (let i = 0; i < 30; i++) {
    const x = Math.random() * 1024;           // ランダムX座標
    const y = Math.random() * 1024;           // ランダムY座標
    const w = Math.random() * 50 + 20;        // 幅20-70px
    const h = Math.random() * 50 + 20;        // 高さ20-70px
    ctx.fillRect(x, y, w, h);
}

// 【追加】水域風の青いエリア  
ctx.fillStyle = 'rgba(64, 164, 223, 0.3)';
for (let i = 0; i < 5; i++) {
    const x = Math.random() * 800 + 100;     // 中央寄りのX座標
    const y = Math.random() * 800 + 100;     // 中央寄りのY座標
    const radius = Math.random() * 80 + 40;  // 半径40-120px
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

    
    const img = new Image();


    img.src = canvas.toDataURL();
    return img;
}
    
// 基本フォールバック画像生成
createBasicFallbackImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // シンプルな緑色の背景
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // 格子パターン
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1024);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1024, i);
        ctx.stroke();
    }
    
    // 中央にメッセージ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('フォールバック画像', 512, 512);
    
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
}


// 【強化版】startBallMovement
async startBallMovement() {
    // ここで初めて状態フラグを設定
    this.isActive = true;
    this.isBallMoving = true;
    
    this.showDebug('🚀 ボール移動開始');
    
    this.debugCanvasState();
    this.debugAerialImageState();
    
    if (!this.ctx) {
        this.showDebug('⚠️ Canvas再初期化中...');
        if (!this.initCanvas()) {
            this.showDebug('❌ Canvas初期化失敗→着地処理');
            this.landBall();
            return;
        }
    }
    
    this.mapElement.style.display = 'none';
    this.gameCanvas.style.display = 'block';
    this.ballElement.style.display = 'none';
    
    this.animationFrame = 0;
    this.backgroundOffsetY = 0;
    
    this.updateStatus(`🏀 ボール投球中... 方向: ${this.getCompassDirection(this.throwAngle)} (${Math.round(this.throwAngle)}°)`);
    
    // 音声再生
    this.showDebug('🔊 音声再生開始');
    this.playKickSound();
    
    this.animateCanvasThrow();
}
    
    // キック音再生（専用メソッド）
    playKickSound() {
        const kickAudio = this.sounds.kick;
        console.log('🔊 キック音再生開始');
        
        try {

            // 音声ファイルの状態をチェック
            console.log('🎵 音声状態:', {
                readyState: kickAudio.readyState,
                networkState: kickAudio.networkState,
                src: kickAudio.src,
                duration: kickAudio.duration
            });


            //再生位置をリセット
            kickAudio.currentTime = 0;
            kickAudio.volume = 1.0;
            
            const playPromise = kickAudio.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('✅ キック音再生成功！');
                    })
                    .catch(error => {
                        console.error('❌ キック音再生失敗:', error);
                        this.fallbackPlayKickSound();
                    });
            } else {
                console.log('✅ キック音再生開始（Promise未サポート）');
            }

            // 再生確認用のタイマー
            setTimeout(() => {
                if (kickAudio.currentTime > 0) {
                    console.log('✅ キック音正常再生中 - 時間:', kickAudio.currentTime);
                } else {
                    console.warn('⚠️ キック音再生されていない可能性があります');
                    this.fallbackPlayKickSound();
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ キック音再生エラー:', error);
            this.fallbackPlayKickSound();
        }
    }
    
    // フォールバック音声再生
    fallbackPlayKickSound() {
        console.log('🔄 フォールバック音声再生を試行');
        
        try {
            const fallbackAudio = new Audio('kick.mp3');
            fallbackAudio.volume = 1.0;
            fallbackAudio.play()
                .then(() => console.log('✅ フォールバック音声再生成功'))
                .catch(e => console.log('⚠️ フォールバック音声も失敗:', e));
        } catch (e) {
            console.log('⚠️ フォールバック音声作成失敗:', e);
        }
    }
    
    // Canvas描画アニメーション（1キロ四方版）
    animateCanvasThrow() {
        // 状態チェックを追加
        if (!this.isActive || !this.isBallMoving || !this.ctx) {
            console.log('❌ キャンバスアニメーション停止 - 状態異常');
            return;
        }
        
        this.animationFrame++;
        const progress = this.animationFrame * 0.005; // スクロール速度を調整

if (progress >= 1) {
    console.log('✅ キャンバスアニメーション完了、着地処理開始');
    this.landBall();

    return;
}
        // 投球距離の更新
        const currentDistance = this.throwPower * progress;
        
        // ボール位置更新（実際の地理的移動）
        const bearing = this.throwAngle * Math.PI / 180;
        const earthRadius = 6371000;
        
        const lat1 = this.startPosition.lat * Math.PI / 180;
        const lng1 = this.startPosition.lng * Math.PI / 180;
        
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(currentDistance / earthRadius) +
            Math.cos(lat1) * Math.sin(currentDistance / earthRadius) * Math.cos(bearing)
        );
        
        const lng2 = lng1 + Math.atan2(
            Math.sin(bearing) * Math.sin(currentDistance / earthRadius) * Math.cos(lat1),
            Math.cos(currentDistance / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
        );
        
        this.ballPosition = {
            lat: lat2 * 180 / Math.PI,
            lng: lng2 * 180 / Math.PI
        };
        
        // Canvas描画
        try {
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        } catch (error) {
            console.error('❌ Canvas clear failed:', error);
            this.landBall();
            return;
        }
        
        // 1キロ四方の背景を下方向にスクロール
        this.drawBackground(currentDistance, progress);
        this.drawCanvasBall(progress);
        
        // 距離表示更新
        const realDistance = this.calculateDistance(
            this.startPosition.lat, this.startPosition.lng,
            this.ballPosition.lat, this.ballPosition.lng
        );
        document.getElementById('distance').textContent = Math.round(realDistance) + 'm';
        this.updateCoordinatesDisplay();
        
        requestAnimationFrame(() => this.animateCanvasThrow());
    }
    

// 【imageSize基準版】imageSizeで決まったサイズで描画
drawBackground(currentDistance, progress) {
    if (!this.ctx || !this.aerialImages.length || !this.aerialImages[0].image) {
        this.showDebug(`❌ 描画前チェック失敗 - ctx:${!!this.ctx}, 画像数:${this.aerialImages.length}`);
        this.drawFallbackBackground(progress);
        return;
    }
    
    try {
        this.ctx.save();
        
        const aerialImage = this.aerialImages[0].image;
        
        // 画像読み込み状態チェック
        if (!aerialImage.complete || aerialImage.naturalWidth === 0) {
            this.showDebug('⚠️ 画像未読み込み→フォールバック');
            this.drawFallbackBackground(progress);
            this.ctx.restore();
            return;  
        }

        // 【修正】画像サイズを2倍に拡大
        const originalWidth = aerialImage.naturalWidth;
        const originalHeight = aerialImage.naturalHeight;
        const imageWidth = originalWidth * 2;  // ← 2倍に拡大
        const imageHeight = originalHeight * 2; // ← 2倍に拡大


        // キャンバスサイズに応じて画像サイズを調整（パワーが大きいほど画像も大きく表示）
        const canvasScale = Math.max(this.canvasWidth / 800, this.canvasHeight / 600); // 基準サイズ比
        const adjustedImageWidth = imageWidth * canvasScale;
        const adjustedImageHeight = imageHeight * canvasScale;


        // キャンバスの中央に画像を配置
        const centerX = (this.canvasWidth - adjustedImageWidth) / 2;
        const centerY = (this.canvasHeight - adjustedImageHeight) / 2;
        
        // 【修正】下方向スクロール計算
        // 画像がキャンバスより大きい場合のみスクロール可能
        const scrollFactor = 1.0; // スクロール量を30%に制限
        const maxScroll = Math.max(0, originalHeight - this.canvasHeight); // ← 元サイズで計算
        const scrollY = centerY + progress * maxScroll * scrollFactor;
        
        // デバッグ情報（10フレームに1回のみ）
        if (this.animationFrame % 10 === 0) {
            this.showDebug(`📊 下スクロール: ${Math.round(progress*100)}%`);
            this.showDebug(`  - 画像サイズ: ${imageWidth}x${imageHeight}`);
            this.showDebug(`  - maxScroll: ${Math.round(maxScroll)}px`);
            this.showDebug(`  - scrollY: ${Math.round(scrollY)}px`);
        }

        // 背景クリア
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 【修正】航空写真を元サイズで描画（下方向スクロール）
        this.ctx.drawImage(
            aerialImage, 
            centerX,     // X位置（中央寄せ）
            scrollY,     // Y位置（下方向スクロール）
            adjustedImageWidth,   // 調整された幅
            adjustedImageHeight   // 調整された高さ
        );

        // 【追加】スクロール確認用の境界線
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(centerX, scrollY, imageWidth, imageHeight);

        // 進行度と情報表示
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `🛰️ 航空写真 ${Math.round(progress * 100)}%`, 
            this.canvasWidth / 2, 
            40
        );

        // 画像情報とスクロール位置表示
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(
            `画像: ${imageWidth}x${imageHeight}px スクロール: ${Math.round(-scrollY)}/${Math.round(maxScroll)}px`, 
            this.canvasWidth / 2, 
            70
        );

        // スクロール可能範囲の警告表示
        if (maxScroll === 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
            this.ctx.fillText(
                '⚠️ 画像が小さすぎてスクロールできません', 
                this.canvasWidth / 2, 
                100
            );
        }

        this.ctx.restore();
        
    } catch (error) {
        this.showDetailedError('背景描画', error);
        this.drawFallbackBackground(progress);
        this.ctx.restore();
    }
}


    
    // Canvas上でのボール描画（改善版）
    drawCanvasBall(progress) {
        if (!this.ctx) return;
        
        try {
            let scale;
            if (progress <= 0.5) {
                scale = 1 + progress * 3;
            } else {
                scale = 4 - (progress - 0.5) * 3;
            }
            scale = Math.max(0.5, Math.min(4, scale));
            
            const ballRadius = 30 * scale;
            
            // ボールの影
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(
                this.ballCanvasX + 5,
                this.ballCanvasY + 5,
                ballRadius * 0.8,
                0, 2 * Math.PI
            );
            this.ctx.fill();
            this.ctx.restore();
            
            // ボール画像描画
            if (this.ballImage && this.ballImage.complete && this.ballImage.naturalWidth > 0) {
                try {
                    const ballSize = ballRadius * 2;
                    
                    this.ctx.save();
                    
                    this.ctx.translate(this.ballCanvasX, this.ballCanvasY);
                    this.ctx.rotate((progress * 360 * 4) * Math.PI / 180);
                    
                    this.ctx.drawImage(
                        this.ballImage,
                        -ballSize / 2,
                        -ballSize / 2,
                        ballSize,
                        ballSize
                    );
                    
                    this.ctx.restore();
                    
                    console.log(`🏀 ボール画像描画成功 (スケール: ${scale.toFixed(2)}x)`);
                    
                } catch (error) {
                    console.error('❌ ボール画像描画エラー:', error);
                    this.drawFallbackBall(ballRadius);
                }
            } else {
                console.log('🟠 フォールバックボール描画');
                this.drawFallbackBall(ballRadius);
            }
            
        } catch (error) {
            console.error('❌ ボール描画全般エラー:', error);
        }
    }
    
    // フォールバックボール描画
    drawFallbackBall(ballRadius) {
        if (!this.ctx) return;
        
        try {
            const gradient = this.ctx.createRadialGradient(
                this.ballCanvasX - ballRadius * 0.3,
                this.ballCanvasY - ballRadius * 0.3,
                0,
                this.ballCanvasX,
                this.ballCanvasY,
                ballRadius
            );
            gradient.addColorStop(0, '#ff8a65');
            gradient.addColorStop(0.7, '#ff5722');
            gradient.addColorStop(1, '#d84315');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(this.ballCanvasX, this.ballCanvasY, ballRadius, 0, 2 * Math.PI);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#ffccbc';
            this.ctx.beginPath();
            this.ctx.arc(
                this.ballCanvasX - ballRadius * 0.3,
                this.ballCanvasY - ballRadius * 0.3,
                ballRadius * 0.2,
                0, 2 * Math.PI
            );
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#bf360c';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.ballCanvasX, this.ballCanvasY, ballRadius, 0, 2 * Math.PI);
            this.ctx.stroke();
            
        } catch (error) {
            console.error('❌ フォールバックボール描画エラー:', error);
        }
    }
    
    // フォールバック背景描画（改善版）
   rawFallbackBackground
    
    clearTrails() {
        const trails = document.querySelectorAll('.ball-trail');
        trails.forEach(trail => trail.remove());
    }
    
    createTrail(x, y) {
        const trail = document.createElement('div');
        trail.className = 'ball-trail';
        trail.style.left = x + 'px';
        trail.style.top = y + 'px';
        document.body.appendChild(trail);
        
        setTimeout(() => {
            if (trail.parentNode) {
                trail.parentNode.removeChild(trail);
            }
        }, 2000);
    }
    
    async landBall() {
        this.isActive = false;
        this.isBallMoving = false;
        
        console.log('🎯 着地処理開始');
        
        this.gameCanvas.style.display = 'none';
        this.mapElement.style.display = 'block';
        this.ballElement.style.display = 'block';
        
        this.playSound('goal');
        
        this.ballElement.classList.remove('throwing', 'flying');
        this.ballElement.style.transform = 'translate(-50%, -50%) scale(1)';
        
        const finalDistance = Math.round(this.calculateDistance(
            this.startPosition.lat, this.startPosition.lng,
            this.ballPosition.lat, this.ballPosition.lng
        ));
        
        console.log('✅ 最終距離:', finalDistance + 'm');
        
        if (this.map) {
            try {
                this.map.setCenter(this.ballPosition);
                
                let currentZoom = this.map.getZoom() || 10;
                const targetZoom = 19;
                const zoomSteps = 30;
                const zoomIncrement = (targetZoom - currentZoom) / zoomSteps;
                
                let step = 0;
                const zoomInterval = setInterval(() => {
                    step++;
                    currentZoom += zoomIncrement;
                    
                    if (step >= zoomSteps) {
                        currentZoom = targetZoom;
                        clearInterval(zoomInterval);
                    }
                    
                    this.map.setZoom(Math.round(currentZoom));
                }, 100);
                
                setTimeout(() => {
                    this.map.setHeading(0);
                }, 3000);
                
            } catch (e) {
                console.warn('❌ 着地時地図更新エラー:', e);
            }
        }
        
        document.getElementById('distance').textContent = finalDistance + 'm';
        
        setTimeout(() => {
            this.clearTrails();
        }, 3000);
        
        this.updateStatus(`🎯 着地完了！飛距離: ${finalDistance}m 方向: ${this.getCompassDirection(this.throwAngle)}`);
        
        setTimeout(() => {
            this.showLandingPanel(finalDistance, this.ballPosition);
        }, 4000);
    }
    
    showLandingPanel(distance, position) {
        document.getElementById('infoPanel').style.display = 'none';
        
        const landingPanel = document.getElementById('landingPanel');
        const results = document.getElementById('results');
        const googleMapBtn = document.getElementById('googleMapBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        results.innerHTML = `🎯 着地完了！<br>飛距離: ${distance}m`;
        
        const googleMapUrl = `https://www.google.com/maps?q=${position.lat},${position.lng}&z=18&t=k`;
        googleMapBtn.href = googleMapUrl;
        
        resetBtn.onclick = () => this.reset();
        
        landingPanel.style.display = 'block';
    }
    
    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
    
    // 音声再生（改善版）
    playSound(soundName) {
        console.log(`🔊 音声再生試行: ${soundName}`);
        if (this.sounds[soundName]) {
            try {
                const audio = this.sounds[soundName];
                
                audio.currentTime = 0;
                audio.volume = 1.0;
                
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log(`✅ ${soundName} 音声再生成功`);
                        })
                        .catch(error => {
                            console.error(`❌ ${soundName} 音声再生失敗:`, error);
                            
                            try {
                                const fallbackAudio = new Audio(audio.src);
                                fallbackAudio.volume = 1.0;
                                fallbackAudio.play()
                                    .then(() => console.log(`✅ ${soundName} フォールバック再生成功`))
                                    .catch(e => console.log(`⚠️ ${soundName} フォールバックも失敗:`, e));
                            } catch (e) {
                                console.log(`⚠️ ${soundName} フォールバック作成失敗:`, e);
                            }
                        });
                }
            } catch (e) {
                console.error(`❌ ${soundName} 音声エラー:`, e);
            }
        } else {
            console.warn(`❌ 音声 ${soundName} が見つかりません`);
        }
    }
    
    reset() {
    console.log('🔄 リセット開始');
    
    if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
    }
    if (this.preparationTimer) {
        clearInterval(this.preparationTimer);
        this.preparationTimer = null;
    }
    
    this.hideCountdown();
    this.hideResourcePreparation();
    
    this.isActive = false;
    this.isCountdownActive = false;
    this.isBallMoving = false;
    this.isDetectingShake = false;
    
    this.accelerationData = [];
    this.maxAcceleration = 0;
    this.totalDistance = 0;
    this.backgroundOffsetY = 0;
    
    // 修正: リセット時に準備状態もリセット
    this.isAudioReady = false;
    this.isAerialImagesReady = false;
    this.isBallImageReady = false;
    
    // 【追加】キャンバスサイズを基本サイズにリセット
    if (this.gameCanvas) {
        const container = this.gameCanvas.parentElement;
        if (container) {

            // キャンバスは常に画面サイズ
            this.canvasWidth = container.clientWidth;
            this.canvasHeight = container.clientHeight;
            
            this.gameCanvas.width = this.canvasWidth;
            this.gameCanvas.height = this.canvasHeight;
            
            // 表示サイズもリセット
            this.gameCanvas.style.width = this.canvasWidth + 'px';
            this.gameCanvas.style.height = this.canvasHeight + 'px';
            
            this.ballCanvasX = this.canvasWidth / 2;
            this.ballCanvasY = this.canvasHeight / 2;
            
            this.showDebug(`🔄 キャンバスサイズリセット: ${this.canvasWidth}x${this.canvasHeight}px`);
        }
        
        this.gameCanvas.style.display = 'none';
    }
    
    if (this.mapElement) {
        this.mapElement.style.display = 'block';
    }
    
    this.ballElement.style.display = 'block';
    this.ballElement.classList.remove('throwing', 'flying');
    this.ballElement.style.transform = 'translate(-50%, -50%) scale(1)';
    
    document.getElementById('powerMeter').style.display = 'none';
    document.getElementById('powerFill').style.height = '0%';
    
    this.clearTrails();
    this.ballPosition = { ...this.startPosition };
    this.loadBallImage();
    
    if (this.isMapReady) {
        this.mapElement.style.transform = `rotate(${-this.heading}deg)`;
    }
    
    if (this.map && this.startPosition) {
        try {
            this.map.setCenter(this.startPosition);
            this.map.setZoom(20);
            this.map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
            this.map.setHeading(0);
        } catch (e) {
            console.warn('❌ 地図リセットエラー:', e);
        }
    }
    
    document.getElementById('landingPanel').style.display = 'none';
    document.getElementById('infoPanel').style.display = 'block';
    
    document.getElementById('distance').textContent = '0m';
    document.getElementById('speed').textContent = '---';
    
    this.updateCoordinatesDisplay();
    this.updateStatus('🎯 投球準備完了！スタートボタンを押してください');
    
    const startBtn = document.getElementById('startBtn');
    startBtn.textContent = '🚀 スタート';
    startBtn.disabled = false;
    startBtn.classList.add('countdown-ready');
    startBtn.onclick = () => this.startCountdown();
}
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="font-size: 20px; margin-bottom: 15px;">⚠️</div>
            <strong>エラーが発生しました</strong><br><br>
            ${message}<br><br>
            <button onclick="location.reload()" style="
                padding: 12px 20px; 
                background: white; 
                color: #d32f2f; 
                border: 2px solid #d32f2f; 
                border-radius: 8px; 
                cursor: pointer;
                font-weight: bold;
            ">
                🔄 再読み込み
            </button>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }
}

// Global app instance
let app = null;


// グローバル関数として startApp を定義
function startApp() {
    console.log('🚀 startApp called');
    
    const startBtn = document.getElementById('startBtn');
    if (!startBtn) {
        console.error('❌ Start button not found');
        return;
    }
    

    // 重複実行防止
    if (startBtn.disabled) {
        console.log('⚠️ Button already disabled');
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = '初期化中...';

    // アプリインスタンス作成
    if (!app) {
        app = new BallThrowJourneyApp();
    }
    
    // 音声準備
    Object.values(app.sounds).forEach(audio => {
        try { audio.load(); } catch (e) { console.warn('Audio load failed'); }
    });

    // アプリ開始
    app.startApp();
}


// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded');
    
    // HTMLにonclick属性がない場合は、ここでイベントリスナーを設定
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startApp);
    }
});