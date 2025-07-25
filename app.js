// 投球パワーに応じたズームレベルと画像サイズを計算
    calculateOptimalImageParams() {
        const powerMeters = this.throwPower;
        this.showDebug(`🎯 投球パワー: ${powerMeters}m`);
        
        let zoom, imageSize;

        // キャンバスサイズに応じて画像サイズを調整
        const canvasScale = Math.max(this.canvasWidth / 800, this.canvasHeight / 600);
        
        // パワーに応じて適切なズームレベルを設定（画像サイズを小さく調整）
        if (powerMeters <= 200) {
            zoom = 18;  // 近距離用：建物詳細レベル
            imageSize = 1024;
        } else if (powerMeters <= 500) {
            zoom = 17;  // 中距離用：街区レベル
            imageSize = 1536;
        } else if (powerMeters <= 1000) {
            zoom = 16;  // 長距離用：地区レベル
            imageSize = 2048;
        } else if (powerMeters <= 2000) {
            zoom = 15;  // 超長距離用：市区レベル
            imageSize = 2560;
        } else {
            zoom = 14;  // 極長距離用：広域レベル
            imageSize = 3072;
        }
        
        this.showDebug(`📐 選択パラメータ: zoom=${zoom}, imageSize=${imageSize}px`);
        
        return { zoom, imageSize };
    }

    // 航空写真準備
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
            
            // 投球方向に回転
            this.showDebug(`🔄 画像回転開始: ${this.throwAngle}度`);
            const rotatedImage = this.rotateImageForThrow(aerialImage, this.throwAngle);
            
            // 回転完了を待つ
            await new Promise((resolve) => {
                if (rotatedImage.complete) {
                    this.showDebug('✅ 回転画像即座に完了');
                    resolve();
                } else {
                    this.showDebug('⏳ 回転画像読み込み待機中...');
                    rotatedImage.onload = () => {
                        this.showDebug('✅ 回転画像読み込み完了');
                        resolve();
                    };
                    rotatedImage.onerror = (e) => {
                        this.showDebug(`❌ 回転画像読み込み失敗: ${e}`);
                        resolve();
                    };
                    setTimeout(() => {
                        this.showDebug('⏰ 回転画像読み込みタイムアウト');
                        resolve();
                    }, 3000);
                }
            });
            
            this.aerialImages = [{
                image: rotatedImage,
                position: this.startPosition,
                distance: 0,
                index: 0,
                zoom: zoom,
                imageSize: imageSize
            }];

            this.showDebug('✅ 地理院地図航空写真準備完了！');
            
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

    // 地理院地図航空写真作成メソッド
    async createGSIAerialImage(lat, lng, zoom, size) {
        this.showDebug(`🗾 地理院地図タイル計算中: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}, zoom=${zoom}`);
        
        // タイル座標計算
        const centerX = this.lonToTileX(lng, zoom);
        const centerY = this.latToTileY(lat, zoom);
        
        this.showDebug(`📐 タイル中心座標: X=${centerX.toFixed(3)}, Y=${centerY.toFixed(3)}`);
        
        // 必要なタイル数計算
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

    // 経度→タイルX座標変換
    lonToTileX(lon, zoom) {
        return (lon + 180) / 360 * Math.pow(2, zoom);
    }

    // 緯度→タイルY座標変換  
    latToTileY(lat, zoom) {
        return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
    }

    // 画像回転メソッド
    rotateImageForThrow(originalImg, throwAngle) {
        this.showDebug(`🔄 ===== 画像回転メソッド呼び出し =====`);
        this.showDebug(`📊 受信パラメータ:`);
        this.showDebug(`  - throwAngle: ${throwAngle}°`);
        this.showDebug(`  - 画像タイプ: ${originalImg.constructor.name}`);
        this.showDebug(`  - 画像サイズ: ${originalImg.width}x${originalImg.height}`);
        
        // 回転角度の詳細計算
        const correctedAngle = -(throwAngle - 90);
        this.showDebug(`🧮 回転角度計算:`);
        this.showDebug(`  - 入力角度: ${throwAngle}°`);
        this.showDebug(`  - 計算式: -(${throwAngle} - 90) = ${correctedAngle}°`);
        
        try {
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
            
            // 回転前の状態を記録
            ctx.save();
            
            // 背景色で回転確認
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
            
            // 回転確認用のマーカー（方向矢印）
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
            this.showDebug(`❌ 画像回転エラー: ${error.message}`);
            this.showDebug(`  → 元画像を返します`);
            return originalImg;
        }
    }

    // 基本フォールバック画像生成
    createBasicFallbackImage() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                throw new Error('Canvas context creation failed');
            }
            
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
        } catch (error) {
            console.error('❌ Fallback image creation failed:', error);
            // 完全にフォールバックが失敗した場合は空のImageオブジェクトを返す
            return new Image();
        }
    }

    // ボール移動開始
    async startBallMovement() {
        // ここで初めて状態フラグを設定
        this.isActive = true;
        this.isBallMoving = true;
        
        this.showDebug('🚀 ボール移動開始');
        
        if (!this.ctx) {
            this.showDebug('⚠️ Canvas再初期化中...');
            if (!this.initCanvas()) {
                this.showDebug('❌ Canvas初期化失敗→着地処理');
                this.landBall();
                return;
            }
        }
        
        if (this.mapElement) {
            this.mapElement.style.display = 'none';
        }
        if (this.gameCanvas) {
            this.gameCanvas.style.display = 'block';
        }
        if (this.ballElement) {
            this.ballElement.style.display = 'none';
        }
        
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
        try {
            const kickAudio = this.sounds.kick;
            if (!kickAudio || typeof kickAudio.play !== 'function') {
                console.warn('⚠️ Kick audio not available');
                return;
            }
            
            console.log('🔊 キック音再生開始');
            
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
    
    // Canvas描画アニメーション
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
        
        // 背景を下方向にスクロール
        this.drawBackground(currentDistance, progress);
        this.drawCanvasBall(progress);
        
        // 距離表示更新
        const realDistance = this.calculateDistance(
            this.startPosition.lat, this.startPosition.lng,
            this.ballPosition.lat, this.ballPosition.lng
        );
        
        const distanceEl = document.getElementById('distance');
        if (distanceEl) {
            distanceEl.textContent = Math.round(realDistance) + 'm';
        }
        this.updateCoordinatesDisplay();
        
        requestAnimationFrame(() => this.animateCanvasThrow());
    }
    
    // 背景描画
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

            // 画像サイズを2倍に拡大
            const originalWidth = aerialImage.naturalWidth;
            const originalHeight = aerialImage.naturalHeight;
            const imageWidth = originalWidth * 2;
            const imageHeight = originalHeight * 2;

            // キャンバスサイズに応じて画像サイズを調整
            const canvasScale = Math.max(this.canvasWidth / 800, this.canvasHeight / 600);
            const adjustedImageWidth = imageWidth * canvasScale;
            const adjustedImageHeight = imageHeight * canvasScale;

            // キャンバスの中央に画像を配置
            const centerX = (this.canvasWidth - adjustedImageWidth) / 2;
            const centerY = (this.canvasHeight - adjustedImageHeight) / 2;
            
            // 下方向スクロール計算
            const scrollFactor = 1.0;
            const maxScroll = Math.max(0, originalHeight - this.canvasHeight);
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

            // 航空写真を描画（下方向スクロール）
            this.ctx.drawImage(
                aerialImage, 
                centerX,
                scrollY,
                adjustedImageWidth,
                adjustedImageHeight
            );

            // スクロール確認用の境界線
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
            if (this.ctx) {
                this.ctx.restore();
            }
        }
    }

    // フォールバック背景描画
    drawFallbackBackground(progress) {
        if (!this.ctx) return;
        
        try {
            // グラデーション背景
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
            gradient.addColorStop(0, '#87CEEB');  // スカイブルー
            gradient.addColorStop(1, '#228B22');  // フォレストグリーン
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            
            // 進行インジケーター
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `フォールバック背景 ${Math.round(progress * 100)}%`,
                this.canvasWidth / 2,
                this.canvasHeight / 2
            );
            
        } catch (error) {
            console.error('❌ フォールバック背景描画エラー:', error);
        }
    }
    
    // Canvas上でのボール描画
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
    
    clearTrails() {
        try {
            const trails = document.querySelectorAll('.ball-trail');
            trails.forEach(trail => trail.remove());
        } catch (error) {
            console.warn('Trail clear error:', error);
        }
    }
    
    createTrail(x, y) {
        try {
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
        } catch (error) {
            console.warn('Trail creation error:', error);
        }
    }
    
    async landBall() {
        this.isActive = false;
        this.isBallMoving = false;
        
        console.log('🎯 着地処理開始');
        
        if (this.gameCanvas) {
            this.gameCanvas.style.display = 'none';
        }
        if (this.mapElement) {
            this.mapElement.style.display = 'block';
        }
        if (this.ballElement) {
            this.ballElement.style.display = 'block';
            this.ballElement.classList.remove('throwing', 'flying');
            this.ballElement.style.transform = 'translate(-50%, -50%) scale(1)';
        }
        
        this.playSound('goal');
        
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
        
        const distanceEl = document.getElementById('distance');
        if (distanceEl) {
            distanceEl.textContent = finalDistance + 'm';
        }
        
        setTimeout(() => {
            this.clearTrails();
        }, 3000);
        
        this.updateStatus(`🎯 着地完了！飛距離: ${finalDistance}m 方向: ${this.getCompassDirection(this.throwAngle)}`);
        
        setTimeout(() => {
            this.showLandingPanel(finalDistance, this.ballPosition);
        }, 4000);
    }
    
    showLandingPanel(distance, position) {
        try {
            const infoPanelEl = document.getElementById('infoPanel');
            if (infoPanelEl) {
                infoPanelEl.style.display = 'none';
            }
            
            const landingPanel = document.getElementById('landingPanel');
            const results = document.getElementById('results');
            const googleMapBtn = document.getElementById('googleMapBtn');
            const resetBtn = document.getElementById('resetBtn');
            
            if (results) {
                results.innerHTML = `🎯 着地完了！<br>飛距離: ${distance}m`;
            }
            
            if (googleMapBtn) {
                const googleMapUrl = `https://www.google.com/maps?q=${position.lat},${position.lng}&z=18&t=k`;
                googleMapBtn.href = googleMapUrl;
            }
            
            if (resetBtn) {
                resetBtn.onclick = () => this.reset();
            }
            
            if (landingPanel) {
                landingPanel.style.display = 'block';
            }
        } catch (error) {
            console.error('❌ Landing panel display error:', error);
        }
    }
    
    updateStatus(message) {
        try {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = message;
            }
        } catch (error) {
            console.warn('Status update error:', error);
        }
    }
    
    // 音声再生（改善版）
    playSound(soundName) {
        console.log(`🔊 音声再生試行: ${soundName}`);
        
        try {
            if (this.sounds[soundName] && typeof this.sounds[soundName].play === 'function') {
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
            } else {
                console.warn(`❌ 音声 ${soundName} が見つかりません`);
            }
        } catch (e) {
            console.error(`❌ ${soundName} 音声エラー:`, e);
        }
    }
    
    reset() {
        console.log('🔄 リセット開始');
        
        try {
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
            
            // リセット時に準備状態もリセット
            this.isAudioReady = false;
            this.isAerialImagesReady = false;
            this.isBallImageReady = false;
            
            // キャンバスサイズを基本サイズにリセット
            if (this.gameCanvas) {
                const container = this.gameCanvas.parentElement;
                if (container) {
                    // キャンバスは常に画面サイズ
                    this.canvasWidth = container.clientWidth || 800;
                    this.canvasHeight = container.clientHeight || 600;
                    
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
            
            if (this.ballElement) {
                this.ballElement.style.display = 'block';
                this.ballElement.classList.remove('throwing', 'flying');
                this.ballElement.style.transform = 'translate(-50%, -50%) scale(1)';
            }
            
            const powerMeterEl = document.getElementById('powerMeter');
            if (powerMeterEl) {
                powerMeterEl.style.display = 'none';
            }
            
            const powerFillEl = document.getElementById('powerFill');
            if (powerFillEl) {
                powerFillEl.style.height = '0%';
            }
            
            this.clearTrails();
            this.ballPosition = { ...this.startPosition };
            this.loadBallImage();
            
            if (this.isMapReady && this.mapElement) {
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
            
            const landingPanelEl = document.getElementById('landingPanel');
            if (landingPanelEl) {
                landingPanelEl.style.display = 'none';
            }
            
            const infoPanelEl = document.getElementById('infoPanel');
            if (infoPanelEl) {
                infoPanelEl.style.display = 'block';
            }
            
            const distanceEl = document.getElementById('distance');
            if (distanceEl) {
                distanceEl.textContent = '0m';
            }
            
            const speedEl = document.getElementById('speed');
            if (speedEl) {
                speedEl.textContent = '---';
            }
            
            this.updateCoordinatesDisplay();
            this.updateStatus('🎯 投球準備完了！スタートボタンを押してください');
            
            const startBtn = document.getElementById('startBtn');
            if (startBtn) {
                startBtn.textContent = '🚀 スタート';
                startBtn.disabled = false;
                startBtn.classList.add('countdown-ready');
                startBtn.onclick = () => this.startCountdown();
            }
            
        } catch (error) {
            console.error('❌ Reset error:', error);
            this.showDetailedError('リセット処理', error);
        }
    }
    
    showError(message) {
        try {
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
        } catch (error) {
            console.error('❌ Error display failed:', error);
        }
    }
}

// Global app instance
let app = null;

// グローバル関数として startApp を定義（エラーハンドリング強化）
function startApp() {
    console.log('🚀 startApp called');
    
    try {
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
        
        // 音声準備（エラーが発生してもアプリを停止しない）
        try {
            Object.values(app.sounds).forEach(audio => {
                try { 
                    if (audio && typeof audio.load === 'function') {
                        audio.load(); 
                    }
                } catch (e) { 
                    console.warn('Audio load failed:', e);
                }
            });
        } catch (error) {
            console.warn('Audio preparation failed:', error);
        }

        // アプリ開始
        app.startApp();
        
    } catch (error) {
        console.error('❌ startApp failed:', error);
        // エラーが発生してもユーザーに分かりやすいメッセージを表示
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = 'エラー - 再試行';
        }
        
        // エラーメッセージを表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ 初期化エラー</h3>
            <p>アプリの初期化に失敗しました。<br>ページを再読み込みしてください。</p>
            <button onclick="location.reload()" style="
                padding: 10px 20px;
                background: white;
                color: red;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin-top: 10px;
            ">🔄 再読み込み</button>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }
}

// DOM読み込み完了時の処理（エラーハンドリング強化）
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded');
    
    try {
        // HTMLにonclick属性がない場合は、ここでイベントリスナーを設定
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            // 既存のonclickがない場合のみ設定
            if (!startBtn.onclick) {
                startBtn.addEventListener('click', startApp);
            }
        } else {
            console.error('❌ Start button not found in DOM');
        }
    } catch (error) {
        console.error('❌ DOM setup failed:', error);
    }
});
            class BallThrowJourneyApp {
    constructor() {
        console.log('🚀 BallThrowJourneyApp initializing...');
        
        // Core elements - 存在チェック追加
        this.map = null;
        this.mapElement = null;
        this.ballElement = null;
        this.compassNeedle = null;
        this.gameCanvas = null;
        this.ctx = null;
        
        // 要素の存在確認
        this.initializeElements();
        
        // Canvas and image data
        this.aerialImages = [];
        this.ballImage = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.ballCanvasX = 0;
        this.ballCanvasY = 0;
        this.backgroundOffsetY = 0;
        
        // Audio elements - より安全な初期化
        this.sounds = {};
        this.initializeAudio();
        
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
        
        // 初期状態表示
        this.updateStatus('位置情報とデバイスセンサーの許可が必要です');

        // デバッグ表示要素を作成
        this.createDebugDisplay();
        console.log('✅ BallThrowJourneyApp initialized');
    }

    // DOM要素の初期化（エラーハンドリング強化）
    initializeElements() {
        try {
            this.mapElement = document.getElementById('map');
            this.ballElement = document.getElementById('ball');
            this.compassNeedle = document.getElementById('compassNeedle');
            this.gameCanvas = document.getElementById('gameCanvas');
            
            // 必須要素の存在確認
            if (!this.mapElement) {
                throw new Error('Map element not found');
            }
            if (!this.ballElement) {
                throw new Error('Ball element not found');
            }
            if (!this.compassNeedle) {
                throw new Error('Compass needle element not found');
            }
            if (!this.gameCanvas) {
                throw new Error('Game canvas element not found');
            }
            
            console.log('✅ All DOM elements found');
            
        } catch (error) {
            console.error('❌ DOM elements initialization failed:', error);
            this.showError('必要なHTML要素が見つかりません: ' + error.message);
        }
    }

    // Audio初期化（より安全な方法）
    initializeAudio() {
        try {
            const audioFiles = ['start.mp3', 'kick.mp3', 'goal.mp3'];
            const audioNames = ['start', 'kick', 'goal'];
            
            audioNames.forEach((name, index) => {
                try {
                    const audio = new Audio();
                    audio.src = audioFiles[index];
                    audio.preload = 'metadata'; // auto から metadata に変更
                    audio.volume = 0.8;
                    
                    // イベントリスナーをより安全に設定
                    audio.addEventListener('canplaythrough', () => {
                        console.log(`✅ Audio ${name} loaded successfully`);
                    }, { once: true });
                    
                    audio.addEventListener('error', (e) => {
                        console.warn(`⚠️ Audio ${name} failed to load:`, e);
                        // エラーが発生してもアプリを停止しない
                    }, { once: true });
                    
                    this.sounds[name] = audio;
                    
                } catch (audioError) {
                    console.warn(`⚠️ Failed to create audio ${name}:`, audioError);
                    // 音声ファイルが作成できない場合はダミーオブジェクトを作成
                    this.sounds[name] = {
                        play: () => Promise.resolve(),
                        load: () => {},
                        volume: 0.8,
                        currentTime: 0
                    };
                }
            });
            
            console.log('✅ Audio initialization completed');
            
        } catch (error) {
            console.error('❌ Audio initialization failed:', error);
            // 音声が完全に失敗した場合のフォールバック
            this.sounds = {
                start: { play: () => Promise.resolve(), load: () => {} },
                kick: { play: () => Promise.resolve(), load: () => {} },
                goal: { play: () => Promise.resolve(), load: () => {} }
            };
        }
    }

    // デバッグ表示を作成
    createDebugDisplay() {
        try {
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
            `;
            this.debugClear.onclick = () => this.clearDebug();
            document.body.appendChild(this.debugClear);

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
            this.showDebug('🚀 スマホ対応デバッグシステム開始');
            
        } catch (error) {
            console.error('❌ Debug display creation failed:', error);
        }
    }

    // センサー状態確認メソッド
    checkSensorStatus() {
        this.showDebug(`🔍 ===== 手動センサー確認 =====`);
        this.showDebug(`⏰ 確認時刻: ${new Date().toLocaleTimeString()}`);
        this.showDebug(`📱 現在のheading: ${this.heading}°`);
        this.showDebug(`📱 現在の方向: ${this.getCompassDirection(this.heading)}`);
        
        // DOM要素の存在確認
        const headingEl = document.getElementById('heading');
        const compassEl = document.getElementById('compass');
        
        if (headingEl && compassEl) {
            this.showDebug(`📱 画面表示: ${headingEl.textContent}`);
            this.showDebug(`📱 コンパス表示: ${compassEl.textContent}`);
        } else {
            this.showDebug(`❌ 表示要素が見つかりません`);
        }
        
        if (this.compassNeedle) {
            this.showDebug(`📱 needle回転: ${this.compassNeedle.style.transform}`);
        } else {
            this.showDebug(`❌ コンパス針要素が見つかりません`);
        }
        
        this.showDebug(`📱 センサー許可: ${this.isPermissionGranted}`);
        this.showDebug(`✅ ===== 確認完了 =====`);
    }

    // デバッグメッセージ表示（安全性向上）
    showDebug(message) {
        try {
            if (this.debugElement) {
                const timestamp = new Date().toLocaleTimeString();
                const newMessage = `[${timestamp}] ${message}`;
                
                // 既存のメッセージに追加（最新を上に）
                this.debugElement.textContent = newMessage + '\n' + this.debugElement.textContent;
                
                // 20行を超えたら古いメッセージを削除
                const lines = this.debugElement.textContent.split('\n');
                if (lines.length > 20) {
                    this.debugElement.textContent = lines.slice(0, 20).join('\n');
                }
                
                // 自動スクロール（最新メッセージが見えるように）
                this.debugElement.scrollTop = 0;
            }
        } catch (error) {
            // デバッグ表示でエラーが発生してもアプリを停止しない
            console.warn('Debug display error:', error);
        }
        
        // コンソールにも出力（PC用）
        console.log(message);
    }
    
    // デバッグ表示切り替え
    toggleDebug() {
        try {
            this.debugVisible = !this.debugVisible;
            if (this.debugElement) {
                this.debugElement.style.display = this.debugVisible ? 'block' : 'none';
            }
            if (this.debugToggle) {
                this.debugToggle.style.background = this.debugVisible ? '#ff4444' : '#888888';
            }
            console.log('Debug表示切り替え:', this.debugVisible);
        } catch (error) {
            console.warn('Debug toggle error:', error);
        }
    }

    // デバッグクリア
    clearDebug() {
        try {
            if (this.debugElement) {
                this.debugElement.textContent = '';
                this.showDebug('🧹 デバッグログクリア');
                console.log('Debug log cleared');
            }
        } catch (error) {
            console.warn('Debug clear error:', error);
        }
    }

    // エラー詳細表示
    showDetailedError(context, error) {
        this.showDebug(`❌ ${context}でエラー発生:`);
        this.showDebug(`  - メッセージ: ${error.message || 'Unknown error'}`);
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
        if (!startBtn) {
            this.showError('スタートボタンが見つかりません');
            return;
        }
        
        console.log('🚀 Starting app...');
        startBtn.disabled = true;
        startBtn.textContent = '初期化中...';
        
        try {
            // 位置情報取得を最初に試行
            this.updateStatus('📍 位置情報を取得中...');
            await this.getCurrentPosition();
            
            // 地図初期化
            this.updateStatus('🗺️ 地図を準備中...');
            await this.initMap();
            
            // センサー許可取得
            this.updateStatus('📱 センサー許可を取得中...');
            await this.requestSensorPermission();
            
            this.setupComplete();
            
        } catch (error) {
            console.error('❌ Setup error:', error);
            this.showDetailedError('アプリ初期化', error);
            this.showError('初期化エラー: ' + (error.message || '不明なエラー'));
            
            // エラーが発生してもフォールバックで継続
            setTimeout(() => {
                this.fallbackSetup();
            }, 2000);
        }
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('⚠️ Geolocation not supported');
                this.showDebug('⚠️ 位置情報サービス未対応 - デフォルト位置を使用');
                resolve(); // エラーにしない
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
                    this.showDebug(`✅ 位置情報取得: ${this.currentPosition.lat.toFixed(6)}, ${this.currentPosition.lng.toFixed(6)}`);
                    resolve();
                },
                (error) => {
                    console.warn('⚠️ Geolocation failed:', error.message);
                    this.showDebug(`⚠️ 位置情報取得失敗: ${error.message} - デフォルト位置を使用`);
                    // エラーが発生してもデフォルト位置で続行
                    resolve();
                },
                options
            );
        });
    }
    
    async initMap() {
        if (!this.mapElement) {
            throw new Error('Map element not available');
        }
        
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'block';
        }
        
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
            this.showDetailedError('地図初期化', error);
            throw error;
        } finally {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }
    
    loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDbZWtPobAYr04A8da3OUOjtNNdjfvkbXA&libraries=geometry`;
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log('✅ Google Maps API loaded');
                this.showDebug('✅ Google Maps API読み込み完了');
                resolve();
            };
            
            script.onerror = () => {
                console.error('❌ Failed to load Google Maps API');
                this.showDebug('❌ Google Maps API読み込み失敗');
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
            // エラーが発生してもセンサーを開始
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
            
            try {
                window.addEventListener('deviceorientation', (event) => {
                    this.handleOrientation(event);
                }, { passive: true });
                this.showDebug(`✅ DeviceOrientationイベント登録完了`);
                
                // 絶対方向イベントも登録
                window.addEventListener('deviceorientationabsolute', (event) => {
                    this.handleAbsoluteOrientation(event);
                }, { passive: true });
                
                this.showDebug(`✅ DeviceOrientationAbsoluteイベント登録完了`);
                
            } catch (error) {
                this.showDebug(`❌ DeviceOrientationイベント登録失敗: ${error.message}`);
            }
            
            // イベント発生確認用のタイマー
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
            
            try {
                window.addEventListener('devicemotion', (event) => {
                    this.handleMotion(event);
                }, { passive: true });
                
                this.showDebug(`✅ DeviceMotionイベント登録完了`);
            } catch (error) {
                this.showDebug(`❌ DeviceMotionイベント登録失敗: ${error.message}`);
                this.setupFallbackShakeDetection();
            }
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
        
        this.showDebug(`📤 テストイベント送信:`);
        this.showDebug(`  - alpha: ${testEvent.alpha}`);
        this.showDebug(`  - webkitCompassHeading: ${testEvent.webkitCompassHeading}`);
        
        // テストイベントでhandleOrientationを呼び出し
        this.handleOrientation(testEvent);
        
        this.showDebug(`📊 テスト結果確認:`);
        this.showDebug(`  - heading更新後: ${this.heading}°`);
        
        const headingEl = document.getElementById('heading');
        if (headingEl) {
            this.showDebug(`  - 画面表示: ${headingEl.textContent}`);
        }
        
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
    
    handleOrientation(event) {
        if (!this.isPermissionGranted) {
            return;
        }
        
        let newHeading = 0;
        
        // iOS方式の確認
        if (event.webkitCompassHeading !== undefined) {
            newHeading = event.webkitCompassHeading;
        }
        // Android方式の確認
        else if (event.alpha !== null) {
            newHeading = 360 - event.alpha;
            if (newHeading >= 360) newHeading -= 360;
            if (newHeading < 0) newHeading += 360;
        }
        
        this.heading = newHeading;
        
        const newTilt = event.beta || 0;
        const currentTime = Date.now();
        const deltaTime = Math.max((currentTime - this.lastTime) / 1000, 0.001);
        const deltaTilt = newTilt - this.lastTilt;
        this.tiltSpeed = Math.abs(deltaTilt) / deltaTime;
        
        this.tilt = newTilt;
        this.lastTilt = newTilt;
        this.lastTime = currentTime;
        
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
        
        // より正確な加速度計算（重力を除去）
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
        
        // パワーメーター表示の安全な更新
        try {
            const powerLevel = Math.min((totalAcceleration / 15) * 100, 100);
            const powerFillEl = document.getElementById('powerFill');
            const speedEl = document.getElementById('speed');
            
            if (powerFillEl) {
                powerFillEl.style.height = powerLevel + '%';
            }
            if (speedEl) {
                speedEl.textContent = `${Math.round(totalAcceleration * 10)/10}`;
            }
        } catch (error) {
            console.warn('Power meter update error:', error);
        }
        
        // 投球検出の閾値調整
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
    
    updateDisplay() {
        try {
            // DOM要素の存在確認
            const headingEl = document.getElementById('heading');
            const compassEl = document.getElementById('compass');
            const tiltEl = document.getElementById('tilt');
            const distanceEl = document.getElementById('distance');
            
            if (headingEl) {
                headingEl.textContent = Math.round(this.heading) + '°';
            }
            if (compassEl) {
                compassEl.textContent = this.getCompassDirection(this.heading);
            }
            if (tiltEl) {
                tiltEl.textContent = Math.round(this.tilt) + '°';
            }
            
            // Update compass needle
            if (this.compassNeedle) {
                this.compassNeedle.style.transform = `rotate(${this.heading}deg)`;
            }
            
            // スタート地点からの距離を計算して表示
            if (!this.isBallMoving && distanceEl) {
                this.totalDistance = this.calculateDistance(
                    this.startPosition.lat, this.startPosition.lng,
                    this.ballPosition.lat, this.ballPosition.lng
                );
                distanceEl.textContent = Math.round(this.totalDistance) + 'm';
            }
            
            // Map rotation management
            const DEAD_ZONE_START = 350;
            const DEAD_ZONE_END = 10;
            
            const isHeadingInDeadZone = (this.heading >= DEAD_ZONE_START && this.heading < 360) || 
                                        (this.heading >= 0 && this.heading < DEAD_ZONE_END);

            if (!this.isActive && !this.isCountdownActive && !this.isBallMoving && 
                this.isMapReady && !isHeadingInDeadZone && this.mapElement) {
                this.mapElement.style.transform = `rotate(${-this.heading}deg)`;
            }
            
            this.updateCoordinatesDisplay();
            
        } catch (error) {
            console.warn('Display update error:', error);
        }
    }
    
    getCompassDirection(heading) {
        const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    updateCoordinatesDisplay() {
        try {
            const coordinatesEl = document.getElementById('coordinates');
            if (coordinatesEl) {
                const lat = this.ballPosition.lat.toFixed(6);
                const lng = this.ballPosition.lng.toFixed(6);
                coordinatesEl.textContent = `${lat}, ${lng}`;
            }
        } catch (error) {
            console.warn('Coordinates display error:', error);
        }
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
        if (startBtn) {
            startBtn.textContent = '🚀 スタート';
            startBtn.disabled = false;
            startBtn.classList.add('countdown-ready');
            startBtn.onclick = () => this.startCountdown();
        }
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
        
        try {
            // 初期サイズは基本サイズで設定
            this.canvasWidth = container.clientWidth || 800;
            this.canvasHeight = container.clientHeight || 600;
            
            if (this.canvasWidth <= 0 || this.canvasHeight <= 0) {
                console.warn('⚠️ Invalid canvas dimensions, using defaults');
                this.canvasWidth = 800;
                this.canvasHeight = 600;
            }
            
            //キャンバスサイズを画面サイズに設定
            this.gameCanvas.width = this.canvasWidth;
            this.gameCanvas.height = this.canvasHeight;
            
            this.ctx = this.gameCanvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Canvas context is null');
            }
            
            this.ballCanvasX = this.canvasWidth / 2;
            this.ballCanvasY = this.canvasHeight / 2;
            
            this.loadBallImage();
            
            console.log('✅ Canvas initialized successfully:', this.canvasWidth, 'x', this.canvasHeight);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize canvas:', error);
            this.showDetailedError('Canvas初期化', error);
            return false;
        }
    }

    // ボール画像読み込み（改善版）
    loadBallImage() {
        console.log('🏀 ボール画像読み込み開始');
        
        try {
            this.ballImage = new Image();

            this.ballImage.onload = () => {
                console.log('✅ Ball image loaded successfully');
                this.isBallImageReady = true;
                this.updatePreparationStatus();
            };
            
            this.ballImage.onerror = () => {
                console.warn('⚠️ Ball image failed to load, trying alternative');
                // ball.pngを試行
                this.ballImage.src = 'ball.png';
                
                // ball.pngも失敗した場合のフォールバック
                this.ballImage.onerror = () => {
                    console.warn('⚠️ ball.png also failed, creating fallback');
                    this.createFallbackBallImage();
                };
            };

            // ball.gif を最初に試行
            this.ballImage.src = 'ball.gif';
            
        } catch (error) {
            console.error('❌ Ball image initialization failed:', error);
            this.createFallbackBallImage();
        }
    }
    
    // フォールバックボール画像生成
    createFallbackBallImage() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                throw new Error('Canvas context creation failed');
            }
            
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
            this.ballImage.onerror = () => {
                console.error('❌ Even fallback ball image failed');
                this.isBallImageReady = true; // 失敗してもフラグを立てて続行
                this.updatePreparationStatus();
            };
            this.ballImage.src = canvas.toDataURL();
            
        } catch (error) {
            console.error('❌ Fallback ball image creation failed:', error);
            this.isBallImageReady = true; // エラーでもフラグを立てて続行
            this.updatePreparationStatus();
        }
    }
    
    fallbackSetup() {
        console.log('🔧 フォールバックセットアップ開始');
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
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.classList.remove('countdown-ready');
        }
        
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
        
        try {
            this.countdownElement = document.createElement('div');
            this.countdownElement.className = 'countdown';
            this.countdownElement.textContent = text;
            document.body.appendChild(this.countdownElement);
        } catch (error) {
            console.warn('Countdown display error:', error);
        }
    }
    
    hideCountdown() {
        try {
            if (this.countdownElement && this.countdownElement.parentNode) {
                this.countdownElement.parentNode.removeChild(this.countdownElement);
                this.countdownElement = null;
            }
        } catch (error) {
            console.warn('Countdown hide error:', error);
        }
    }
    
    enableThrowDetection() {
        this.isCountdownActive = false;
        this.isDetectingShake = true;
        this.accelerationData = [];
        this.maxAcceleration = 0;
        
        const powerMeterEl = document.getElementById('powerMeter');
        if (powerMeterEl) {
            powerMeterEl.style.display = 'block';
        }
        
        this.updateStatus('📱 スマホを振って投球してください！（3回タップまたは長押しでも可能）');
        
        // 15秒でタイムアウト
        setTimeout(() => {
            if (!this.isActive && this.isDetectingShake) {
                this.isDetectingShake = false;
                if (powerMeterEl) {
                    powerMeterEl.style.display = 'none';
                }
                this.updateStatus('⏰ タイムアウトしました。再度お試しください。');
                this.reset();
            }
        }, 15000);
    }
    
    startThrowWithShake() {
        if (this.isActive || !this.isDetectingShake) return;
        
        // 投球時のみ詳細デバッグ実行
        this.showDebug(`🎯 ===== 投球開始 - 詳細ログ =====`);
        this.showDebug(`⏰ 投球時刻: ${new Date().toLocaleTimeString()}`);
        
        // 現在のセンサー状態
        this.showDebug(`📱 現在のheading: ${this.heading}°`);
        this.showDebug(`📱 現在の方向: ${this.getCompassDirection(this.heading)}`);
        
        // DOM要素の存在確認
        const headingEl = document.getElementById('heading');
        const compassEl = document.getElementById('compass');
        
        if (headingEl && compassEl) {
            this.showDebug(`📱 画面表示heading: ${headingEl.textContent}`);
            this.showDebug(`📱 画面表示方向: ${compassEl.textContent}`);
        }
        
        // heading値の妥当性チェック
        if (this.heading === 0) {
            this.showDebug(`⚠️ WARNING: heading=0°（センサー未更新の可能性）`);
        } else {
            this.showDebug(`✅ heading正常更新済み`);
        }
        
        console.log('🎯 投球準備処理開始');
        this.isDetectingShake = false;
        
        const powerMeterEl = document.getElementById('powerMeter');
        if (powerMeterEl) {
            powerMeterEl.style.display = 'none';
        }
        
        // パワー計算
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
        
        // 【重要】投球角度設定
        this.throwAngle = this.heading;
        
        this.showDebug(`🎯 投球角度設定:`);
        this.showDebug(`  - this.heading → this.throwAngle: ${this.heading}° → ${this.throwAngle}°`);
        this.showDebug(`  - 方向: ${this.getCompassDirection(this.throwAngle)}`);
        this.showDebug(`  - パワー: ${this.throwPower}m`);
        
        // 画像回転予測
        const correctedAngle = -(this.throwAngle - 90);
        this.showDebug(`🔄 画像回転予測:`);
        this.showDebug(`  - -(${this.throwAngle} - 90) = ${correctedAngle}°`);
        
        this.showDebug(`✅ ===== 投球準備完了 =====`);
        
        console.log(`投球検出! 最大加速度: ${this.maxAcceleration.toFixed(2)}, パワー: ${this.throwPower}m, 方向: ${this.throwAngle}°`);
        
        if (this.ballElement) {
            this.ballElement.classList.add('throwing');
        }
        this.ballTrailPoints = [];
        this.clearTrails();
        this.ballPosition = { ...this.startPosition };
        
        this.showResourcePreparation();
    }
    
    showResourcePreparation() {
        try {
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
        } catch (error) {
            console.error('❌ Resource preparation display failed:', error);
            this.showDetailedError('リソース準備画面表示', error);
            // エラーでも直接ボール移動を開始
            this.startBallMovement();
        }
    }
    
    async prepareResources() {
        console.log('🚀 リソース準備開始');

        // 状態をリセット
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
        
        try {
            const kickAudio = this.sounds.kick;
            if (!kickAudio) {
                console.warn('⚠️ Kick audio not available, skipping');
                this.isAudioReady = true;
                this.updatePreparationStatus();
                return;
            }
            
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
                try {
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
                } catch (newAudioError) {
                    console.log('⚠️ 新しい音声インスタンス作成失敗、続行');
                    this.isAudioReady = true;
                    this.updatePreparationStatus();
                }
                cleanup();
            };

            const cleanup = () => {
                try {
                    kickAudio.removeEventListener('canplaythrough', onCanPlay);
                    kickAudio.removeEventListener('error', onError);
                } catch (e) {
                    console.warn('Audio cleanup error:', e);
                }
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
            
        } catch (error) {
            console.error('❌ Audio preparation failed:', error);
            this.isAudioReady = true;
            this.updatePreparationStatus();
        }
    }
        
    updatePreparationStatus() {
        if (!this.preparationOverlay) return;
        
        try {
            const statusAudio = this.preparationOverlay.querySelector('#statusAudio');
            const statusImages = this.preparationOverlay.querySelector('#statusImages');
            const statusBall = this.preparationOverlay.querySelector('#statusBall');
            const kickButton = this.preparationOverlay.querySelector('#kickButton');
            
            if (this.isAudioReady && statusAudio) {
                statusAudio.className = 'status-item status-ready';
                statusAudio.textContent = '🔊 効果音: 準備完了 ✅';
            }
            
            if (this.isAerialImagesReady && statusImages) {
                statusImages.className = 'status-item status-ready';
                statusImages.textContent = `🛰️ 航空写真: 準備完了 (${this.aerialImages.length}枚) ✅`;
            }
            
            if (this.isBallImageReady && statusBall) {
                statusBall.className = 'status-item status-ready';
                statusBall.textContent = '🏀 ボール画像: 準備完了 ✅';
            }
            
            if (this.isAudioReady && this.isAerialImagesReady && this.isBallImageReady && kickButton) {
                kickButton.disabled = false;
                kickButton.textContent = '🚀 KICK!';
                kickButton.onclick = () => {
                    this.hideResourcePreparation();
                     // ここでボール移動を開始
                    this.startBallMovement();
                };
                
                console.log('🎯 全リソース準備完了！Kickボタン有効化');
            }
        } catch (error) {
            console.warn('Preparation status update error:', error);
        }
    }
    
    hideResourcePreparation() {
        try {
            if (this.preparationOverlay && this.preparationOverlay.parentNode) {
                this.preparationOverlay.parentNode.removeChild(this.preparationOverlay);
                this.preparationOverlay = null;
            }
        } catch (error) {
            console.warn('Resource preparation hide error:', error);
        }
    }