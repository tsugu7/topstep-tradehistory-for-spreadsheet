/**
 * ProjectX API 取引履歴取得スクリプト
 * 特定日の取引履歴を取得します
 */

// 基本設定
const CONFIG = {
  BASE_URL: 'https://api.topstepx.com/api',
  AUTH_ENDPOINT: '/Auth/loginKey',
  ACCOUNT_SEARCH_ENDPOINT: '/Account/search',
  TRADE_SEARCH_ENDPOINT: '/Trade/search',
  // 実際の使用時にはこれらを適切な値に変更してください
  USERNAME: 'YOUR_USERNAME',
  API_KEY: 'YOUR_API_KEY'
};

/**
 * メイン実行関数
 * 指定日の取引履歴を取得します
 * @param {string} targetDate - 対象日（YYYY-MM-DD形式）
 * @return {Object} 取引履歴結果
 */
function getTradeHistory(targetDate = '2025-05-08') {
  try {
    // 認証トークンを取得
    const token = authenticate(CONFIG.USERNAME, CONFIG.API_KEY);
    if (!token) {
      throw new Error('認証に失敗しました');
    }
    
    // アカウント情報の取得
    const accounts = searchAccounts(token);
    if (!accounts || accounts.length === 0) {
      return { success: false, message: 'アクティブなアカウントが見つかりませんでした' };
    }
    
    // 指定日の開始・終了タイムスタンプを生成
    const { startTimestamp, endTimestamp } = getDateTimestamps(targetDate);
    
    // 結果を格納する配列
    const results = [];
    
    // 各アカウントの取引履歴を取得
    accounts.forEach(account => {
      const trades = searchTrades(token, account.id, startTimestamp, endTimestamp);
      results.push({
        accountId: account.id,
        accountName: account.name,
        balance: account.balance,
        tradeCount: trades.length,
        trades: trades
      });
    });
    
    return {
      success: true,
      date: targetDate,
      results: results
    };
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * API認証を行い、トークンを取得します
 * @param {string} userName - ユーザー名
 * @param {string} apiKey - APIキー
 * @return {string} 認証トークン
 */
function authenticate(userName, apiKey) {
  const url = CONFIG.BASE_URL + CONFIG.AUTH_ENDPOINT;
  const payload = {
    userName: userName,
    apiKey: apiKey
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.success && responseData.errorCode === 0) {
      return responseData.token;
    } else {
      throw new Error('認証エラー: ' + (responseData.errorMessage || '不明なエラー'));
    }
  } catch (error) {
    Logger.log('認証中にエラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * アカウント情報を検索します
 * @param {string} token - 認証トークン
 * @return {Array} アカウント情報の配列
 */
function searchAccounts(token) {
  const url = CONFIG.BASE_URL + CONFIG.ACCOUNT_SEARCH_ENDPOINT;
  const payload = {
    onlyActiveAccounts: true
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Bearer ' + token
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.success && responseData.errorCode === 0) {
      return responseData.accounts;
    } else {
      throw new Error('アカウント検索エラー: ' + (responseData.errorMessage || '不明なエラー'));
    }
  } catch (error) {
    Logger.log('アカウント検索中にエラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * 取引履歴を検索します
 * @param {string} token - 認証トークン
 * @param {number} accountId - アカウントID
 * @param {string} startTimestamp - 開始タイムスタンプ
 * @param {string} endTimestamp - 終了タイムスタンプ
 * @return {Array} 取引履歴の配列
 */
function searchTrades(token, accountId, startTimestamp, endTimestamp) {
  const url = CONFIG.BASE_URL + CONFIG.TRADE_SEARCH_ENDPOINT;
  const payload = {
    accountId: accountId,
    startTimestamp: startTimestamp,
    endTimestamp: endTimestamp
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Bearer ' + token
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.success && responseData.errorCode === 0) {
      return responseData.trades || [];
    } else {
      throw new Error('取引検索エラー: ' + (responseData.errorMessage || '不明なエラー'));
    }
  } catch (error) {
    Logger.log('取引検索中にエラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * 指定日の開始・終了タイムスタンプを生成します
 * @param {string} dateString - 日付文字列（YYYY-MM-DD形式）
 * @return {Object} 開始・終了タイムスタンプを含むオブジェクト
 */
function getDateTimestamps(dateString) {
  // 日付の妥当性チェック
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('無効な日付形式です。YYYY-MM-DD形式で指定してください。');
  }
  
  // 開始タイムスタンプ（その日の0時0分0秒）
  const startDate = new Date(dateString + 'T00:00:00Z');
  const startTimestamp = startDate.toISOString();
  
  // 終了タイムスタンプ（その日の23時59分59秒）
  const endDate = new Date(dateString + 'T23:59:59Z');
  const endTimestamp = endDate.toISOString();
  
  return {
    startTimestamp: startTimestamp,
    endTimestamp: endTimestamp
  };
}

/**
 * 取引履歴をスプレッドシートに出力する関数
 * @param {string} targetDate - 対象日（YYYY-MM-DD形式）
 * @param {Object} result - 取引履歴データ
 * @return {Object} 処理結果
 */
function writeTradeHistoryToSheet(targetDate, result) {
  if (!result.success) {
    Logger.log('取引履歴の取得に失敗しました: ' + result.message);
    return {
      success: false,
      message: '取引履歴の取得に失敗しました: ' + result.message
    };
  }
  
  try {
    // アクティブなスプレッドシート
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('取引履歴') || ss.insertSheet('取引履歴');
    sheet.clear();
    
    // ヘッダー行
    sheet.appendRow(['日付', '取得日時', 'アカウントID', 'アカウント名', '残高', '取引ID', '契約ID', '取引時刻', '価格', '損益', '手数料', '側面', 'サイズ', '無効フラグ', '注文ID']);
    
    // データ行
    const currentTime = new Date().toISOString();
    let rowCount = 0;
    
    result.results.forEach(accountResult => {
      accountResult.trades.forEach(trade => {
        sheet.appendRow([
          targetDate,
          currentTime,
          accountResult.accountId,
          accountResult.accountName,
          accountResult.balance,
          trade.id,
          trade.contractId,
          trade.creationTimestamp,
          trade.price,
          trade.profitAndLoss,
          trade.fees,
          trade.side === 0 ? '買い' : '売り',
          trade.size,
          trade.voided ? 'はい' : 'いいえ',
          trade.orderId
        ]);
        rowCount++;
      });
    });
    
    // シートの書式設定
    sheet.autoResizeColumns(1, 15);
    
    return {
      success: true,
      message: `取引履歴をスプレッドシートに出力しました（合計${rowCount}件）`,
      sheetName: '取引履歴'
    };
  } catch (error) {
    Logger.log('スプレッドシート出力中にエラーが発生しました: ' + error.message);
    return {
      success: false,
      message: 'スプレッドシート出力中にエラーが発生しました: ' + error.message
    };
  }
}

/**
 * メイン実行関数 - 取引履歴を取得してスプレッドシートに出力します
 * この関数を呼び出すだけでプロセス全体が実行されます
 * @param {string} targetDate - 対象日（YYYY-MM-DD形式, デフォルトは2025-05-08）
 * @return {Object} 処理結果
 */
function main(targetDate = '2025-05-08') {
  try {
    Logger.log(`${targetDate}の取引履歴取得を開始します...`);
    
    // 取引履歴の取得
    const tradeHistoryResult = getTradeHistory(targetDate);
    
    if (!tradeHistoryResult.success) {
      return {
        success: false,
        message: `取引履歴の取得に失敗しました: ${tradeHistoryResult.message}`
      };
    }
    
    Logger.log(`取引履歴の取得に成功しました。スプレッドシートに出力します...`);
    
    // スプレッドシートへの出力
    const sheetResult = writeTradeHistoryToSheet(targetDate, tradeHistoryResult);
    
    return sheetResult;
  } catch (error) {
    Logger.log(`実行中にエラーが発生しました: ${error.message}`);
    return {
      success: false,
      message: `実行中にエラーが発生しました: ${error.message}`
    };
  }
}
