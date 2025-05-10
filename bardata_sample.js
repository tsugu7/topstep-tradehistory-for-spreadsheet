/**
 * ProjectX Gateway APIを使用してNQの5分足ローソク足データを取得しスプレッドシートに出力する
 * 
 * @author AIアシスタント
 * @version 1.0.0
 */

// APIの設定値
const CONFIG = {
  BASE_URL: 'https://api.topstepx.com/api', // ProjectX Gateway APIのベースURL
  USERNAME: 'your_login_id', // APIログイン用のユーザー名
  API_KEY: 'your_api_key, // APIキー
  SEARCH_KEYWORD: 'NQ', // 検索キーワード
  TARGET_SYMBOL: 'ENQ', // 対象シンボル（E-mini NASDAQ-100）
  
  // ローソク足データ取得の設定
  CANDLE_UNIT: 2, // 2 = 分
  CANDLE_UNIT_NUMBER: 5, // 5分足
  LIVE_DATA: false // シミュレーションデータを使用
};

// グローバル変数
let SESSION_TOKEN = ''; // セッショントークン（認証後に設定）

/**
 * APIにログインしてセッショントークンを取得
 * 
 * @return {string} セッショントークン
 */
function login() {
  try {
    const endpoint = `${CONFIG.BASE_URL}/Auth/loginKey`;
    
    const payload = {
      userName: CONFIG.USERNAME,
      apiKey: CONFIG.API_KEY
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      throw new Error(`ログインに失敗しました (ステータスコード: ${statusCode}): ${response.getContentText()}`);
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.success) {
      throw new Error(`ログインに失敗しました: ${responseData.errorMessage || 'Unknown error'}`);
    }
    
    return responseData.token;
  } catch (error) {
    Logger.log(`認証中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * 指定された日付のローソク足データを取得する
 * 
 * @param {string} dateStr - 取得する日付 (YYYY-MM-DD形式)
 * @param {string} contractId - 取得するコントラクトID
 * @return {Object} - APIから取得したローソク足データ
 */
function fetchCandlestickData(dateStr, contractId) {
  try {
    // トークンがなければログイン
    if (!SESSION_TOKEN) {
      SESSION_TOKEN = login();
    }
    
    // 日付の処理
    const targetDate = new Date(dateStr);
    const startTime = new Date(dateStr);
    const endTime = new Date(dateStr);
    
    // 開始時刻を設定 (00:00:00)
    startTime.setHours(0, 0, 0, 0);
    
    // 終了時刻を設定 (23:59:59)
    endTime.setHours(23, 59, 59, 999);
    
    // API リクエストのエンドポイント
    const endpoint = `${CONFIG.BASE_URL}/History/retrieveBars`;
    
    // リクエストペイロードの作成
    const payload = {
      contractId: contractId,
      live: CONFIG.LIVE_DATA,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      unit: CONFIG.CANDLE_UNIT,       // 2 = 分
      unitNumber: CONFIG.CANDLE_UNIT_NUMBER,  // 5分足
      limit: 1000,                    // 十分に大きな制限値
      includePartialBar: false        // 部分的なバーは含めない
    };
    
    // HTTPリクエストのオプション設定
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    // APIリクエスト実行
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    
    // 認証失敗時（トークン期限切れ）は再認証
    if (statusCode === 401) {
      Logger.log('セッショントークンが期限切れです。再認証します...');
      SESSION_TOKEN = login();
      options.headers.Authorization = `Bearer ${SESSION_TOKEN}`;
      return fetchCandlestickData(dateStr, contractId);
    }
    
    if (statusCode !== 200) {
      throw new Error(`ローソク足データの取得に失敗しました (ステータスコード: ${statusCode}): ${response.getContentText()}`);
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.success) {
      throw new Error(`ローソク足データの取得に失敗しました: ${responseData.errorMessage || 'Unknown error'}`);
    }
    
    return responseData;
  } catch (error) {
    Logger.log(`ローソク足データ取得中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * 指定されたキーワードでコントラクトを検索し、対象のシンボルのアクティブなコントラクトを抽出する
 * 
 * @param {string} searchKeyword - 検索キーワード（例: 'NQ'）
 * @param {string} targetSymbol - 抽出対象のシンボル（例: 'ENQ'）
 * @return {string} - 最新のアクティブなコントラクトID
 */
function findActiveContract(searchKeyword, targetSymbol) {
  try {
    // トークンがなければログイン
    if (!SESSION_TOKEN) {
      SESSION_TOKEN = login();
    }
    
    const endpoint = `${CONFIG.BASE_URL}/Contract/search`;
    
    const payload = {
      searchText: searchKeyword,
      live: CONFIG.LIVE_DATA
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    
    // 認証失敗時（トークン期限切れ）は再認証
    if (statusCode === 401) {
      Logger.log('セッショントークンが期限切れです。再認証します...');
      SESSION_TOKEN = login();
      options.headers.Authorization = `Bearer ${SESSION_TOKEN}`;
      return findActiveContract(searchKeyword, targetSymbol);
    }
    
    if (statusCode !== 200) {
      throw new Error(`コントラクト検索に失敗しました (ステータスコード: ${statusCode}): ${response.getContentText()}`);
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.success) {
      throw new Error(`コントラクト検索に失敗しました: ${responseData.errorMessage || 'Unknown error'}`);
    }
    
    // コントラクトが見つからない場合
    if (!responseData.contracts || responseData.contracts.length === 0) {
      throw new Error(`キーワード '${searchKeyword}' に一致するコントラクトが見つかりませんでした。`);
    }
    
    // 検索結果をログに出力（デバッグ用）
    Logger.log(`検索結果: ${responseData.contracts.length}件のコントラクトが見つかりました。`);
    
    // 全てのコントラクトをログ出力
    responseData.contracts.forEach((contract, index) => {
      Logger.log(`${index + 1}: ID=${contract.id}, NAME=${contract.name}, ACTIVE=${contract.activeContract}, DESC=${contract.description}`);
    });
    
    // 対象シンボル（ENQ）を含むIDかつアクティブなコントラクトをフィルタリング
    const targetContracts = responseData.contracts.filter(contract => 
      contract.activeContract === true && 
      contract.id.includes(targetSymbol)
    );
    
    if (targetContracts.length === 0) {
      throw new Error(`IDに '${targetSymbol}' を含むアクティブなコントラクトが見つかりませんでした。`);
    }
    
    // 抽出された候補をログに出力（デバッグ用）
    Logger.log(`対象シンボル '${targetSymbol}' を含むコントラクト: ${targetContracts.length}件見つかりました。`);
    targetContracts.forEach((contract, index) => {
      Logger.log(`候補${index + 1}: ${contract.id}, ${contract.name}, ${contract.description}`);
    });
    
    // 最新のコントラクトを特定（コントラクト名をソートして最新を取得）
    // ENQコントラクトの場合、名前は通常「ENQH25」「ENQM25」などで、H,M,U,Zなどの月コードと年を表す数字が続く
    targetContracts.sort((a, b) => {
      // コントラクト名から月コードと年を抽出して比較
      const nameA = a.name;
      const nameB = b.name;
      
      // ソート基準：まず年（新しい順）、次に月コード（新しい順）
      // 名前が月コードと年を含まない場合は単純に名前を比較
      if (nameA.length >= 5 && nameB.length >= 5) {
        const monthCodeA = nameA.slice(-3, -2);
        const monthCodeB = nameB.slice(-3, -2);
        const yearA = nameA.slice(-2);
        const yearB = nameB.slice(-2);
        
        // 年の比較
        if (yearA !== yearB) {
          return yearB - yearA; // 降順（新しい年が先）
        }
        
        // 月コードの比較（H=3月, M=6月, U=9月, Z=12月）
        const monthOrder = {'H': 3, 'M': 6, 'U': 9, 'Z': 12};
        if (monthOrder[monthCodeA] && monthOrder[monthCodeB]) {
          return monthOrder[monthCodeB] - monthOrder[monthCodeA]; // 降順（新しい月が先）
        }
      }
      
      // フォールバック：IDで比較
      return a.id.localeCompare(b.id);
    });
    
    // 最新のアクティブなコントラクトを返す
    const latestContract = targetContracts[0];
    Logger.log(`最新のアクティブな${targetSymbol}コントラクトを選択: ${latestContract.id} (${latestContract.description})`);
    
    return latestContract.id;
  } catch (error) {
    Logger.log(`コントラクト検索中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * 指定された日付のNQの5分足ローソク足データを取得してスプレッドシートに出力
 * 
 * @param {string} dateStr - 取得する日付 (YYYY-MM-DD形式)
 * @param {string} sheetName - データを出力するシート名（省略時は'NQData'）
 * @return {boolean} - 処理が成功したらtrue、失敗したらfalse
 */
function fetchAndOutputNQData(dateStr, sheetName = 'NQData') {
  try {
    // 入力チェック
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error('日付は「YYYY-MM-DD」形式で指定してください。');
    }
    
    // 「NQ」キーワードで検索して「ENQ」シンボルのアクティブなコントラクトを検索
    const contractId = findActiveContract(CONFIG.SEARCH_KEYWORD, CONFIG.TARGET_SYMBOL);
    
    // ローソク足データを取得
    Logger.log(`コントラクトID: ${contractId} の5分足データを取得します...`);
    const candleData = fetchCandlestickData(dateStr, contractId);
    
    if (!candleData.bars || candleData.bars.length === 0) {
      throw new Error(`${dateStr}のENQデータが見つかりませんでした。`);
    }
    
    // APIから返ってきたローソク足データの総数をログに記録
    Logger.log(`APIから合計 ${candleData.bars.length} 件のデータを取得しました。これから指定日付のみをフィルタリングします。`);
    
    // スプレッドシートにデータを出力（日付でフィルタリングしながら）
    outputToSpreadsheet(candleData, sheetName, dateStr);
    
    Logger.log(`${dateStr}のENQデータ処理が完了しました。`);
    return true;
    
  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.message}`);
    return false;
  }
}

/**
 * ローソク足データをスプレッドシートに出力する
 * 
 * @param {Object} candleData - APIから取得したローソク足データ
 * @param {string} sheetName - 出力先のシート名
 * @param {string} dateStr - フィルタリングする日付 (YYYY-MM-DD形式)
 */
function outputToSpreadsheet(candleData, sheetName, dateStr) {
  try {
    // アクティブなスプレッドシートを取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 指定されたシートが存在するか確認し、なければ作成
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      // シートが既に存在する場合はクリア
      sheet.clear();
    }
    
    // ヘッダー行の作成
    const headers = ['Timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    // データがない場合は終了
    if (!candleData.bars || candleData.bars.length === 0) {
      sheet.getRange(2, 1).setValue('No data available');
      return;
    }
    
    // 指定された日付
    const filterDate = new Date(dateStr);
    filterDate.setHours(0, 0, 0, 0);
    
    // 次の日の日付（フィルタリング用）
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // ローソク足データを変換し、指定された日付のデータのみをフィルタリング
    const formattedData = candleData.bars
      .filter(bar => {
        const barDate = new Date(bar.t);
        return barDate >= filterDate && barDate < nextDay;
      })
      .map(bar => {
        const timestamp = new Date(bar.t);
        return [
          timestamp,
          bar.o,
          bar.h,
          bar.l,
          bar.c,
          bar.v
        ];
      });
    
    // データをスプレッドシートに書き込み
    if (formattedData.length > 0) {
      sheet.getRange(2, 1, formattedData.length, headers.length).setValues(formattedData);
      
      // タイムスタンプ列を日付形式に設定
      sheet.getRange(2, 1, formattedData.length, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
      
      // 数値列のフォーマット設定
      sheet.getRange(2, 2, formattedData.length, 4).setNumberFormat('#,##0.00');
      sheet.getRange(2, 6, formattedData.length, 1).setNumberFormat('#,##0');
      
      // ログに実際に出力したデータ数を記録
      Logger.log(`指定日付（${dateStr}）のデータ ${formattedData.length} 件をスプレッドシートに出力しました。`);
    } else {
      sheet.getRange(2, 1).setValue(`指定された日付（${dateStr}）のデータはありませんでした。`);
      Logger.log(`指定日付（${dateStr}）のデータはありませんでした。`);
    }
    
    // 列の幅を自動調整
    sheet.autoResizeColumns(1, headers.length);
    
    // ヘッダー行を固定
    sheet.setFrozenRows(1);
    
  } catch (error) {
    Logger.log(`データ出力中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * APIからアカウント情報を取得
 * 
 * @param {boolean} onlyActiveAccounts - アクティブなアカウントのみ取得するかどうか
 * @return {Object} アカウント情報
 */
function fetchAccounts(onlyActiveAccounts = true) {
  try {
    // トークンがなければログイン
    if (!SESSION_TOKEN) {
      SESSION_TOKEN = login();
    }
    
    const endpoint = `${CONFIG.BASE_URL}/Account/search`;
    
    const payload = {
      onlyActiveAccounts: onlyActiveAccounts
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    
    // 認証失敗時（トークン期限切れ）は再認証
    if (statusCode === 401) {
      Logger.log('セッショントークンが期限切れです。再認証します...');
      SESSION_TOKEN = login();
      options.headers.Authorization = `Bearer ${SESSION_TOKEN}`;
      return fetchAccounts(onlyActiveAccounts);
    }
    
    if (statusCode !== 200) {
      throw new Error(`アカウント情報の取得に失敗しました (ステータスコード: ${statusCode}): ${response.getContentText()}`);
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.success) {
      throw new Error(`アカウント情報の取得に失敗しました: ${responseData.errorMessage || 'Unknown error'}`);
    }
    
    return responseData;
  } catch (error) {
    Logger.log(`アカウント情報取得中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * main関数 - スクリプト実行のエントリーポイント
 * この関数を実行することで処理が完了します
 */
function main() {
  // 処理開始メッセージを表示
  Logger.log('E-mini NASDAQ-100（ENQ）5分足データ取得処理を開始します...');
  
  const targetDate = '2025-05-08'; // デフォルト日付 (YYYY-MM-DD形式)
  const sheetName = 'ENQ_5min_Data'; // 出力先シート名
  
  try {
    // セッショントークンの初期化
    SESSION_TOKEN = '';
    
    // ログイン処理を実行
    Logger.log('API認証を実行します...');
    SESSION_TOKEN = login();
    Logger.log('認証に成功しました。');
    
    // データ取得処理を実行
    Logger.log(`${targetDate}のデータ取得を開始します...`);
    const result = fetchAndOutputNQData(targetDate, sheetName);
    
    if (result) {
      Logger.log('データ取得が正常に完了しました。');
      // アクティブなスプレッドシートを取得してメッセージを表示
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        ss.toast('データの取得が完了しました', '処理完了', 5);
      }
      return true;
    } else {
      Logger.log('データ取得に失敗しました。');
      return false;
    }
  } catch (error) {
    Logger.log(`処理中にエラーが発生しました: ${error.message}`);
    return false;
  }
}

/**
 * メイン関数 - 指定した日付のデータを取得（実行関数）
 */
function getDataForSpecificDate() {
  const targetDate = '2025-05-08'; // 取得したい日付を指定 (YYYY-MM-DD形式)
  const sheetName = 'ENQ_5min_Data'; // 出力先シート名
  
  const result = fetchAndOutputNQData(targetDate, sheetName);
  
  if (result) {
    SpreadsheetApp.getActiveSpreadsheet().toast('データの取得が完了しました', '処理完了', 5);
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('データの取得に失敗しました', 'エラー', 5);
  }
}

/**
 * スプレッドシートのUIにメニューを追加する
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ENQデータ取得')
    .addItem('データ取得実行（メイン処理）', 'main')
    .addSeparator()
    .addItem('特定日付のデータを取得', 'getDataForSpecificDate')
    .addSeparator()
    .addItem('日付を指定してデータを取得', 'showDatePickerDialog')
    .addSeparator()
    .addItem('アカウント情報を表示', 'showAccountInfo')
    .addToUi();
}

/**
 * 日付選択ダイアログを表示する
 */
function showDatePickerDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    '日付を指定',
    '取得したい日付をYYYY-MM-DD形式で入力してください:',
    ui.ButtonSet.OK_CANCEL
  );
  
  // OK以外のボタンが押された場合は終了
  if (result.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const dateStr = result.getResponseText().trim();
  
  // 入力チェック
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    ui.alert('エラー', '日付は「YYYY-MM-DD」形式で指定してください。', ui.ButtonSet.OK);
    return;
  }
  
  // データ取得処理実行
  const fetchResult = fetchAndOutputNQData(dateStr, 'ENQ_5min_Data');
  
  if (fetchResult) {
    ui.alert('成功', `${dateStr}のデータを正常に取得しました。`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `${dateStr}のデータ取得に失敗しました。`, ui.ButtonSet.OK);
  }
}

/**
 * アカウント情報を表示する
 */
function showAccountInfo() {
  try {
    const accountInfo = fetchAccounts();
    
    if (!accountInfo.accounts || accountInfo.accounts.length === 0) {
      SpreadsheetApp.getUi().alert('情報', 'アクティブなアカウントが見つかりませんでした。', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    // アクティブなスプレッドシートを取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'アカウント情報';
    
    // シートの作成または取得
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    
    // ヘッダー行の作成
    const headers = ['ID', 'アカウント名', '残高', '取引可能', '表示可能'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    // アカウントデータを変換
    const accountData = accountInfo.accounts.map(account => [
      account.id,
      account.name,
      account.balance,
      account.canTrade ? 'はい' : 'いいえ',
      account.isVisible ? 'はい' : 'いいえ'
    ]);
    
    // データをシートに書き込み
    sheet.getRange(2, 1, accountData.length, headers.length).setValues(accountData);
    
    // 列の幅を自動調整
    sheet.autoResizeColumns(1, headers.length);
    
    // 数値列のフォーマット設定
    sheet.getRange(2, 3, accountData.length, 1).setNumberFormat('#,##0.00');
    
    // ヘッダー行を固定
    sheet.setFrozenRows(1);
    
    SpreadsheetApp.getUi().alert('成功', 'アカウント情報を取得しました。', SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    Logger.log(`アカウント情報の表示中にエラーが発生しました: ${error.message}`);
    SpreadsheetApp.getUi().alert('エラー', `アカウント情報の取得に失敗しました: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
