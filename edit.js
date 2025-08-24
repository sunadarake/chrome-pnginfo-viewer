/**
 * PNGinfo Viewer - メイン JavaScript
 * 画像アップロード、PNGメタデータ解析、複数画像対応を提供
 */

class PNGInfoViewer {
    constructor() {
        this.uploadedImages = [];
        this.currentImageIndex = -1;
        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const uploadButton = document.getElementById('uploadButton');
        const resetButton = document.getElementById('resetButton');

        // ファイル選択
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        uploadButton.addEventListener('click', () => fileInput.click());

        // リセットボタン
        resetButton.addEventListener('click', () => this.resetAll());

        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    /**
     * ドラッグ&ドロップ機能を設定
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'image/png');
            this.processFiles(files);
        });
    }

    /**
     * ファイル選択時の処理
     * @param {Event} event - ファイル選択イベント
     */
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    /**
     * ファイル処理
     * @param {File[]} files - 処理するファイル配列
     */
    async processFiles(files) {
        const pngFiles = files.filter(file => file.type === 'image/png');
        
        if (pngFiles.length === 0) {
            this.showError('PNG画像ファイルを選択してください。');
            return;
        }

        for (const file of pngFiles) {
            try {
                const imageData = await this.readFileAsArrayBuffer(file);
                const metadata = await this.parsePNGMetadata(imageData);
                const preview = await this.createImagePreview(file);
                
                this.uploadedImages.push({
                    file,
                    metadata,
                    preview,
                    name: file.name
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                this.showError(`${file.name}の処理中にエラーが発生しました。`);
            }
        }

        this.updateImageList();
        this.showFirstImage();
    }

    /**
     * ファイルをArrayBufferとして読み込み
     * @param {File} file - 読み込むファイル
     * @returns {Promise<ArrayBuffer>} - ファイルデータ
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 画像プレビューを作成
     * @param {File} file - 画像ファイル
     * @returns {Promise<string>} - データURL
     */
    createImagePreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('プレビュー作成エラー'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * PNGメタデータを解析
     * @param {ArrayBuffer} buffer - PNG画像データ
     * @returns {Object} - 解析されたメタデータ
     */
    async parsePNGMetadata(buffer) {
        const dataView = new DataView(buffer);
        const metadata = {
            textChunks: {},
            technicalInfo: {},
            rawChunks: []
        };

        // PNG署名を確認
        const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < 8; i++) {
            if (dataView.getUint8(i) !== pngSignature[i]) {
                throw new Error('Invalid PNG file');
            }
        }

        let offset = 8; // PNG署名の後から開始

        while (offset < buffer.byteLength - 8) {
            // チャンク長を読み取り
            const chunkLength = dataView.getUint32(offset);
            const chunkType = this.readString(dataView, offset + 4, 4);
            const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLength);
            const crc = dataView.getUint32(offset + 8 + chunkLength);

            // チャンク情報を記録
            metadata.rawChunks.push({
                type: chunkType,
                length: chunkLength,
                offset: offset
            });

            // チャンクタイプに応じて処理
            await this.processChunk(chunkType, chunkData, metadata);

            offset += 12 + chunkLength; // 次のチャンクへ

            // IENDチャンクで終了
            if (chunkType === 'IEND') break;
        }

        return metadata;
    }

    /**
     * チャンクを処理
     * @param {string} type - チャンクタイプ
     * @param {ArrayBuffer} data - チャンクデータ
     * @param {Object} metadata - メタデータオブジェクト
     */
    async processChunk(type, data, metadata) {
        const dataView = new DataView(data);

        switch (type) {
            case 'IHDR':
                metadata.technicalInfo.width = dataView.getUint32(0);
                metadata.technicalInfo.height = dataView.getUint32(4);
                metadata.technicalInfo.bitDepth = dataView.getUint8(8);
                metadata.technicalInfo.colorType = dataView.getUint8(9);
                metadata.technicalInfo.compression = dataView.getUint8(10);
                metadata.technicalInfo.filter = dataView.getUint8(11);
                metadata.technicalInfo.interlace = dataView.getUint8(12);
                break;

            case 'tEXt':
                const textData = this.parseTextChunk(data);
                if (textData) {
                    metadata.textChunks[textData.keyword] = textData.text;
                }
                break;

            case 'iTXt':
                const itextData = this.parseITextChunk(data);
                if (itextData) {
                    metadata.textChunks[itextData.keyword] = itextData.text;
                }
                break;

            case 'zTXt':
                const ztextData = await this.parseZTextChunk(data);
                if (ztextData) {
                    metadata.textChunks[ztextData.keyword] = ztextData.text;
                }
                break;

            case 'pHYs':
                if (data.byteLength >= 9) {
                    const pixelsPerUnitX = dataView.getUint32(0);
                    const pixelsPerUnitY = dataView.getUint32(4);
                    const unitSpecifier = dataView.getUint8(8);
                    metadata.technicalInfo.physicalDimensions = {
                        pixelsPerUnitX,
                        pixelsPerUnitY,
                        unit: unitSpecifier === 1 ? 'meters' : 'unknown'
                    };
                }
                break;

            case 'tIME':
                if (data.byteLength >= 7) {
                    const year = dataView.getUint16(0);
                    const month = dataView.getUint8(2);
                    const day = dataView.getUint8(3);
                    const hour = dataView.getUint8(4);
                    const minute = dataView.getUint8(5);
                    const second = dataView.getUint8(6);
                    metadata.technicalInfo.lastModified = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
                }
                break;
        }
    }

    /**
     * tEXtチャンクを解析
     * @param {ArrayBuffer} data - チャンクデータ
     * @returns {Object|null} - 解析結果
     */
    parseTextChunk(data) {
        try {
            const bytes = new Uint8Array(data);
            const nullIndex = bytes.indexOf(0);
            if (nullIndex === -1) return null;

            const keyword = new TextDecoder('latin1').decode(bytes.slice(0, nullIndex));
            const text = new TextDecoder('latin1').decode(bytes.slice(nullIndex + 1));
            
            return { keyword, text };
        } catch (error) {
            console.error('Error parsing tEXt chunk:', error);
            return null;
        }
    }

    /**
     * iTXtチャンクを解析
     * @param {ArrayBuffer} data - チャンクデータ
     * @returns {Object|null} - 解析結果
     */
    parseITextChunk(data) {
        try {
            const bytes = new Uint8Array(data);
            let offset = 0;

            // キーワードを読み取り
            const keywordEnd = bytes.indexOf(0, offset);
            if (keywordEnd === -1) return null;
            const keyword = new TextDecoder('latin1').decode(bytes.slice(offset, keywordEnd));
            offset = keywordEnd + 1;

            // 圧縮フラグとメソッド
            const compressionFlag = bytes[offset++];
            const compressionMethod = bytes[offset++];

            // 言語タグ
            const langTagEnd = bytes.indexOf(0, offset);
            if (langTagEnd === -1) return null;
            offset = langTagEnd + 1;

            // 翻訳キーワード
            const translatedKeywordEnd = bytes.indexOf(0, offset);
            if (translatedKeywordEnd === -1) return null;
            offset = translatedKeywordEnd + 1;

            // テキストデータ
            const textBytes = bytes.slice(offset);
            const text = new TextDecoder('utf-8').decode(textBytes);
            
            return { keyword, text };
        } catch (error) {
            console.error('Error parsing iTXt chunk:', error);
            return null;
        }
    }

    /**
     * zTXtチャンクを解析
     * @param {ArrayBuffer} data - チャンクデータ
     * @returns {Promise<Object|null>} - 解析結果
     */
    async parseZTextChunk(data) {
        try {
            const bytes = new Uint8Array(data);
            const nullIndex = bytes.indexOf(0);
            if (nullIndex === -1) return null;

            const keyword = new TextDecoder('latin1').decode(bytes.slice(0, nullIndex));
            const compressionMethod = bytes[nullIndex + 1];
            
            if (compressionMethod !== 0) return null; // deflate圧縮のみサポート
            
            const compressedData = bytes.slice(nullIndex + 2);
            
            // DecompressionStreamが利用可能な場合に使用
            if (typeof DecompressionStream !== 'undefined') {
                const ds = new DecompressionStream('deflate');
                const writer = ds.writable.getWriter();
                const reader = ds.readable.getReader();
                
                writer.write(compressedData);
                writer.close();
                
                const result = await reader.read();
                const text = new TextDecoder('latin1').decode(result.value);
                
                return { keyword, text };
            } else {
                // フォールバック: 圧縮解除をスキップ
                return { keyword, text: '[Compressed data - decompression not supported]' };
            }
        } catch (error) {
            console.error('Error parsing zTXt chunk:', error);
            return null;
        }
    }

    /**
     * DataViewから文字列を読み取り
     * @param {DataView} dataView - DataView
     * @param {number} offset - オフセット
     * @param {number} length - 長さ
     * @returns {string} - 文字列
     */
    readString(dataView, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(dataView.getUint8(offset + i));
        }
        return str;
    }

    /**
     * 画像リストを更新
     */
    updateImageList() {
        const imageList = document.getElementById('imageList');
        const imageListSection = document.getElementById('imageListSection');
        
        if (this.uploadedImages.length === 0) {
            imageListSection.style.display = 'none';
            return;
        }

        imageListSection.style.display = 'block';
        imageList.innerHTML = '';

        this.uploadedImages.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'image-item';
            if (index === this.currentImageIndex) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <img src="${image.preview}" alt="${image.name}" class="image-thumbnail">
                <div class="image-filename">${image.name}</div>
            `;

            item.addEventListener('click', () => this.showImage(index));
            imageList.appendChild(item);
        });
    }

    /**
     * 最初の画像を表示
     */
    showFirstImage() {
        if (this.uploadedImages.length > 0) {
            this.showImage(0);
        }
    }

    /**
     * 指定された画像を表示
     * @param {number} index - 画像のインデックス
     */
    showImage(index) {
        if (index < 0 || index >= this.uploadedImages.length) return;

        this.currentImageIndex = index;
        const image = this.uploadedImages[index];

        // UI表示を更新
        this.updateImageList();
        this.displayImageInfo(image);
        this.displayMetadata(image.metadata);

        // PNGinfoセクションを表示
        document.getElementById('pnginfoSection').style.display = 'block';
    }

    /**
     * 画像情報を表示
     * @param {Object} image - 画像オブジェクト
     */
    displayImageInfo(image) {
        const previewImage = document.getElementById('previewImage');
        const currentFilename = document.getElementById('currentFilename');
        const imageInfo = document.getElementById('imageInfo');

        previewImage.src = image.preview;
        currentFilename.textContent = image.name;

        const fileSize = this.formatFileSize(image.file.size);
        const dimensions = `${image.metadata.technicalInfo.width || '?'} × ${image.metadata.technicalInfo.height || '?'}`;
        
        imageInfo.innerHTML = `
            ファイルサイズ: ${fileSize}<br>
            解像度: ${dimensions}<br>
            ビット深度: ${image.metadata.technicalInfo.bitDepth || '?'}bit<br>
            カラータイプ: ${this.getColorTypeName(image.metadata.technicalInfo.colorType)}
        `;
    }

    /**
     * メタデータを表示
     * @param {Object} metadata - メタデータ
     */
    displayMetadata(metadata) {
        this.displayTextMetadata(metadata.textChunks);
        this.displayTechnicalMetadata(metadata.technicalInfo);
        this.displayRawMetadata(metadata.rawChunks);
    }

    /**
     * テキストメタデータを表示
     * @param {Object} textChunks - テキストチャンク
     */
    displayTextMetadata(textChunks) {
        const textMetadata = document.getElementById('textMetadata');
        
        if (Object.keys(textChunks).length === 0) {
            textMetadata.innerHTML = '<div class="metadata-item">テキスト情報は見つかりませんでした。</div>';
            return;
        }

        let html = '';
        for (const [key, value] of Object.entries(textChunks)) {
            html += `
                <div class="metadata-item">
                    <div class="metadata-key">${this.escapeHtml(key)}</div>
                    <div class="metadata-value">${this.escapeHtml(value)}</div>
                </div>
            `;
        }
        textMetadata.innerHTML = html;
    }

    /**
     * 技術情報を表示
     * @param {Object} technicalInfo - 技術情報
     */
    displayTechnicalMetadata(technicalInfo) {
        const technicalMetadata = document.getElementById('technicalMetadata');
        
        let html = '<h3>基本情報</h3>';
        html += `
            <div class="metadata-item">
                <div class="metadata-key">幅</div>
                <div class="metadata-value">${technicalInfo.width || 'N/A'} px</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">高さ</div>
                <div class="metadata-value">${technicalInfo.height || 'N/A'} px</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">ビット深度</div>
                <div class="metadata-value">${technicalInfo.bitDepth || 'N/A'}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">カラータイプ</div>
                <div class="metadata-value">${technicalInfo.colorType !== undefined ? `${technicalInfo.colorType} (${this.getColorTypeName(technicalInfo.colorType)})` : 'N/A'}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">圧縮方式</div>
                <div class="metadata-value">${technicalInfo.compression !== undefined ? technicalInfo.compression : 'N/A'}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">フィルタ方式</div>
                <div class="metadata-value">${technicalInfo.filter !== undefined ? technicalInfo.filter : 'N/A'}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-key">インターレース</div>
                <div class="metadata-value">${technicalInfo.interlace !== undefined ? (technicalInfo.interlace ? 'Yes' : 'No') : 'N/A'}</div>
            </div>
        `;

        if (technicalInfo.physicalDimensions) {
            html += '<h3>物理的寸法</h3>';
            html += `
                <div class="metadata-item">
                    <div class="metadata-key">X方向解像度</div>
                    <div class="metadata-value">${technicalInfo.physicalDimensions.pixelsPerUnitX} pixels/${technicalInfo.physicalDimensions.unit}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-key">Y方向解像度</div>
                    <div class="metadata-value">${technicalInfo.physicalDimensions.pixelsPerUnitY} pixels/${technicalInfo.physicalDimensions.unit}</div>
                </div>
            `;
        }

        if (technicalInfo.lastModified) {
            html += '<h3>タイムスタンプ</h3>';
            html += `
                <div class="metadata-item">
                    <div class="metadata-key">最終更新</div>
                    <div class="metadata-value">${technicalInfo.lastModified}</div>
                </div>
            `;
        }

        technicalMetadata.innerHTML = html;
    }

    /**
     * 生データを表示
     * @param {Array} rawChunks - 生チャンクデータ
     */
    displayRawMetadata(rawChunks) {
        const rawMetadata = document.getElementById('rawMetadata');
        
        let html = '<h3>チャンク情報</h3>';
        rawChunks.forEach((chunk, index) => {
            html += `
                <div class="metadata-item">
                    <div class="metadata-key">チャンク #${index + 1}: ${chunk.type}</div>
                    <div class="metadata-value">長さ: ${chunk.length} bytes, オフセット: 0x${chunk.offset.toString(16).toUpperCase()}</div>
                </div>
            `;
        });

        rawMetadata.innerHTML = html;
    }

    /**
     * タブを切り替え
     * @param {string} tabName - タブ名
     */
    switchTab(tabName) {
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // パネルの表示を切り替え
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}Panel`).classList.add('active');
    }

    /**
     * すべてをリセット
     */
    resetAll() {
        this.uploadedImages = [];
        this.currentImageIndex = -1;

        // UI要素をリセット
        document.getElementById('imageListSection').style.display = 'none';
        document.getElementById('pnginfoSection').style.display = 'none';
        document.getElementById('fileInput').value = '';

        // エラーメッセージをクリア
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msg => msg.remove());
    }

    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        // 既存のエラーメッセージを削除
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(error => error.remove());

        // 新しいエラーメッセージを作成
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        // アップロードセクションの後に挿入
        const uploadSection = document.querySelector('.upload-section');
        uploadSection.parentNode.insertBefore(errorDiv, uploadSection.nextSibling);

        // 5秒後に自動削除
        setTimeout(() => errorDiv.remove(), 5000);
    }

    /**
     * ファイルサイズをフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} - フォーマットされたサイズ
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * カラータイプ名を取得
     * @param {number} colorType - カラータイプ
     * @returns {string} - カラータイプ名
     */
    getColorTypeName(colorType) {
        const colorTypes = {
            0: 'グレースケール',
            2: 'トゥルーカラー',
            3: 'インデックスカラー',
            4: 'グレースケール + アルファ',
            6: 'トゥルーカラー + アルファ'
        };
        return colorTypes[colorType] || '不明';
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープするテキスト
     * @returns {string} - エスケープされたテキスト
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// DOMContentLoadedでアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    new PNGInfoViewer();
});