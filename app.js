// 既存のrequestSensorPermissionメソッドを以下で置き換えてください

async requestSensorPermission() {
    this.showDebug('🔐 ===== iOS対応センサー許可取得開始 =====');
    
    try {
        // iOS環境の詳細チェック
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        
        this.showDebug(`📱 環境情報:`);
        this.showDebug(`  - iOS端末: ${isIOS}`);
        this.showDebug(`  - Safari: ${isSafari}`);
        this.showDebug(`  - HTTPS: ${location.protocol === 'https:'}`);
        this.showDebug(`  - DeviceMotionEvent: ${typeof DeviceMotionEvent !== 'undefined'}`);
        this.showDebug(`  - requestPermission: ${typeof DeviceMotionEvent.requestPermission === 'function'}`);
        
        // iOS 13+ のDeviceOrientationEvent許可
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            
            this.showDebug(`📲 iOS DeviceOrientation許可要求...`);
            
            try {
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                this.showDebug(`📋 DeviceOrientation許可結果: ${orientationPermission}`);
                
                if (orientationPermission !== 'granted') {
                    throw new Error('デバイス方向センサーの許可が拒否されました');
                }
            } catch (error) {
                this.showDebug(`❌ DeviceOrientation許可エラー: ${error.message}`);
                throw error;
            }
        }
        
        // iOS 13+ のDeviceMotionEvent許可（加速度センサー）
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            
            this.showDebug(`📲 iOS DeviceMotion許可要求...`);
            
            try {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                this.showDebug(`📋 DeviceMotion許可結果: ${motionPermission}`);
                
                if (motionPermission !== 'granted') {
                    throw new Error('デバイスモーションセンサーの許可が拒否されました。設定で許可してください。');
                }
                
                this.showDebug(`✅ iOS DeviceMotion許可取得成功！`);
                
            } catch (error) {
                this.showDebug(`❌ DeviceMotion許可エラー: ${error.message}`);
                throw error;
            }
        }
        
        // センサー開始
        this.showDebug(`🚀 センサー開始処理実行...`);
        this.startSensors();
        
        // センサー動作確認タイマー
        this.startSensorVerificationTimer();
        
    } catch (error) {
        this.showDebug(`❌ センサー許可失敗: ${error.message}`);
        this.showError(`センサー許可エラー: ${error.message}`);
        
        // フォールバック
        this.showDebug(`🔄 フォールバックモードで継続...`);
        this.startSensors();
    }
}

// 新しいメソッド: センサー動作確認タイマー
startSensorVerificationTimer() {
    this.showDebug(`⏰ センサー動作確認タイマー開始（5秒後）`);
    
    setTimeout(() => {
        const currentHeading = this.heading;
        const currentTilt = this.tilt;
        
        this.showDebug(`📊 5秒後のセンサー状態確認:`);
        this.showDebug(`  - heading: ${currentHeading}°`);
        this.showDebug(`  - tilt: ${currentTilt}°`);
        this.showDebug(`  - maxAcceleration: ${this.maxAcceleration}`);
        
        if (currentHeading === 0 && currentTilt === 0) {
            this.showDebug(`⚠️ センサー値が初期値のまま - トラブルシューティング開始`);
            this.troubleshootIOSSensors();
        } else {
            this.showDebug(`✅ センサー正常動作中`);
        }
    }, 5000);
}

// 新しいメソッド: iOS専用トラブルシューティング
troubleshootIOSSensors() {
    this.showDebug(`🔧 ===== iOS センサートラブルシューティング =====`);
    
    // 手動でテスト値を設定して処理を確認
    this.showDebug(`🧪 手動テスト値設定...`);
    
    const testOrientation = {
        alpha: 45,
        beta: 10,
        gamma: 5,
        webkitCompassHeading: 45,
        absolute: true
    };
    
    const testMotion = {
        acceleration: { x: 2, y: 1, z: 0.5 },
        accelerationIncludingGravity: { x: 2, y: 1, z: 9.8 },
        rotationRate: { alpha: 0, beta: 0, gamma: 0 }
    };
    
    this.showDebug(`📤 テスト方向イベント送信...`);
    this.handleOrientation(testOrientation);
    
    this.showDebug(`📤 テストモーションイベント送信...`);
    this.handleMotion(testMotion);
    
    setTimeout(() => {
        this.showDebug(`📊 テスト後のセンサー値:`);
        this.showDebug(`  - heading: ${this.heading}°`);
        this.showDebug(`  - tilt: ${this.tilt}°`);
        
        if (this.heading !== 0) {
            this.showDebug(`✅ handleOrientation処理は正常`);
            this.showDebug(`❌ 実際のセンサーイベントが発生していない`);
            this.showDebug(`💡 可能な解決策:`);
            this.showDebug(`   1. Safariの設定 > プライバシーとセキュリティ > モーションと方向のアクセス を確認`);
            this.showDebug(`   2. ページをHTTPS環境で実行`);
            this.showDebug(`   3. デバイスを実際に傾けてみる`);
            
            this.showDebug(`🔄 強制センサー開始を試行...`);
            this.forceSensorStart();
        } else {
            this.showDebug(`❌ handleOrientation処理にも問題あり`);
        }
    }, 1000);
}

// 新しいメソッド: 強制センサー開始
forceSensorStart() {
    this.showDebug(`🔧 強制センサー開始...`);
    
    // イベントリスナーを再設定
    window.removeEventListener('deviceorientation', this.handleOrientation.bind(this));
    window.removeEventListener('devicemotion', this.handleMotion.bind(this));
    
    // 即座に再設定
    window.addEventListener('deviceorientation', this.handleOrientation.bind(this), { passive: false });
    window.addEventListener('devicemotion', this.handleMotion.bind(this), { passive: false });
    
    this.showDebug(`✅ イベントリスナー再設定完了`);
    
    // さらに alternative イベントも試行
    window.addEventListener('deviceorientationabsolute', (event) => {
        this.showDebug(`🧭 DeviceOrientationAbsolute受信: ${event.alpha}°`);
        this.handleAbsoluteOrientation(event);
    }, { passive: false });
    
    // 10秒後に最終確認
    setTimeout(() => {
        if (this.heading === 0) {
            this.showDebug(`❌ 強制開始も失敗 - フォールバックモード有効化`);
            this.enableFallbackMode();
        } else {
            this.showDebug(`✅ 強制開始成功！`);
        }
    }, 10000);
}

// 新しいメソッド: フォールバックモード
enableFallbackMode() {
    this.showDebug(`🆘 フォールバックモード有効化`);
    
    // タッチでの方向制御を追加
    let touchStartX = 0;
    let touchStartY = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            const normalizedAngle = ((angle + 90) % 360 + 360) % 360;
            
            this.heading = normalizedAngle;
            this.showDebug(`👆 タッチスワイプ方向設定: ${Math.round(normalizedAngle)}°`);
            this.updateDisplay();
        }
    });
    
    this.showDebug(`✅ フォールバックモード: タッチスワイプで方向制御可能`);
    this.updateStatus('⚠️ センサー無効 - スワイプで方向を設定してください');
}

// handleMotionメソッドも修正
handleMotion(event) {
    if (!this.isDetectingShake) return;
    
    // iOS特有の処理を追加
    const acceleration = event.acceleration || event.accelerationIncludingGravity;
    if (!acceleration) {
        this.showDebug('⚠️ 加速度データが取得できません');
        return;
    }
    
    // デバッグ出力（1秒に1回）
    const shouldDebug = !this.lastMotionDebug || (Date.now() - this.lastMotionDebug) > 1000;
    if (shouldDebug) {
        this.showDebug(`📊 Motion受信: x=${acceleration.x?.toFixed(2)}, y=${acceleration.y?.toFixed(2)}, z=${acceleration.z?.toFixed(2)}`);
        this.lastMotionDebug = Date.now();
    }
    
    // 加速度計算（iOS向け調整）
    let totalAcceleration;
    if (event.acceleration && event.acceleration.x !== null) {
        // 重力除去済みデータ
        totalAcceleration = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) + 
            Math.pow(acceleration.y || 0, 2) + 
            Math.pow(acceleration.z || 0, 2)
        );
    } else {
        // 重力込みデータから推定
        const x = acceleration.x || 0;
        const y = acceleration.y || 0;
        const z = acceleration.z || 0;
        
        // iOS では重力の影響を考慮して調整
        const gravityCompensatedZ = Math.abs(z) > 8 ? z - Math.sign(z) * 9.8 : z;
        totalAcceleration = Math.sqrt(x * x + y * y + gravityCompensatedZ * gravityCompensatedZ);
    }
    
    // iOS では閾値を調整（より敏感に）
    const iosAdjustedThreshold = this.shakeThreshold * 0.7; // 30%低く
    
    const currentTime = Date.now();
    this.accelerationData.push({
        value: totalAcceleration,
        timestamp: currentTime
    });
    
    // 最新1秒間のデータのみ保持
    this.accelerationData = this.accelerationData.filter(
        data => currentTime - data.timestamp <= 1000
    );
    
    if (totalAcceleration > this.maxAcceleration) {
        this.maxAcceleration = totalAcceleration;
    }
    
    // パワーメーター表示（iOS向け調整）
    const powerLevel = Math.min((totalAcceleration / 12) * 100, 100); // より敏感に
    document.getElementById('powerFill').style.height = powerLevel + '%';
    document.getElementById('speed').textContent = `${Math.round(totalAcceleration * 10)/10}`;
    
    // 投球検出（iOS向け調整済み閾値）
    if (totalAcceleration > iosAdjustedThreshold && this.maxAcceleration > iosAdjustedThreshold) {
        this.showDebug(`🎯 iOS投球検出！加速度: ${totalAcceleration.toFixed(2)}, 最大: ${this.maxAcceleration.toFixed(2)}`);
        this.startThrowWithShake();
    }
}