const xrpl = require('xrpl');

class XRPLClient {
  // インスタンス生成時にネットワーククライアントを定義し、シークレット情報からウォレット情報を取得します
  constructor() {
    this.client = new xrpl.Client(process.env.XRPL_NETWORK);
    this.wallet = xrpl.Wallet.fromSecret(process.env.XRPL_ACCOUNT_SECRET)
    this.isConnected = false;
  }
  // XRPLに接続
  async connect() {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('Connected to XRPL');
    } catch (error) {
      console.error('Failed to connect to XRPL:', error);
      throw error;
    }
  }
  // XRPLから切断
  async disconnect() {
    try {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('Disconnected from XRPL');
    } catch (error) {
      console.error('Failed to disconnect from XRPL:', error);
      throw error;
    }
  }
  // 自分がオーダーしたすべての注文を取得
  async getOrders() {
    const response = await this.client.request({
      command: 'account_offers',
      account: process.env.XRPL_ACCOUNT_ADDRESS
    });
    return response.result;
  }
  // 売り注文のオーダーブックを取得
  async getAskOrderBook() {
    try {
      const response = await this.client.request({
        command: 'book_offers',
        taker_gets: {
          currency: 'XRP'
        },
        taker_pays: {
          currency: process.env.CURRENCY,
          issuer: process.env.CURRENCY_ISSUER
        },
        limit: 1
      })
      return response.result
    } catch (error) {
      console.error('Failed to request ask order book:', error);
      return [];
    }
  }
  // 買い注文のオーダーブックを取得
  async getBitOrderBook() {
    try {
      const response = await this.client.request({
        command: 'book_offers',
        taker_gets: {
          currency: process.env.CURRENCY,
          issuer: process.env.CURRENCY_ISSUER
        },
        taker_pays: {
          currency: 'XRP'
        },
        limit: 1
      })
      return response.result
    } catch (error) {
      console.error('Failed to request bit order book:', error);
      return [];
    }
  }
  // 自分のアカウントのXRP残高を取得
  async getXrpBalance() {
    const response = await this.client.getXrpBalance(
      process.env.XRPL_ACCOUNT_ADDRESS,
      { ledger_index: "validated"},
    );
    return response - 10;
  }
  // 自分のアカウントでトラストラインを引いたトークンの中から取引するトークンの残高を取得
  async getAvailableTokenBalance() {
    const response = await this.client.request({
      command: 'account_lines',
      account: process.env.XRPL_ACCOUNT_ADDRESS
    });
    if (response.result.lines.length > 0) {
      for (let i = 0; i < response.result.lines.length; i++) {
        if (response.result.lines[i].currency == process.env.CURRENCY &&
          response.result.lines[i].account == process.env.CURRENCY_ISSUER) {
          return response.result.lines[i].balance;
        }
      }
    }
    return 0;
  }
  // 注文をキャンセルする
  async cancelOrder(offer) {
    try {
      await this.client.submit({
        TransactionType: 'OfferCancel',
        Account: process.env.XRPL_ACCOUNT_ADDRESS,
        OfferSequence: offer.seq
      }, { wallet: this.wallet })
      console.log(`Succcess cancel order seq: ${offer.seq}`);
    } catch (error) {
      console.error('Failed to request cancel order:', error);
      // throw error;
    }
  }
  // 買い注文をオーダーする
  async buyOrder(xrpAmount, currencyAmount) {
    try {
      await this.client.submit({
        TransactionType: "OfferCreate",
        Account: process.env.XRPL_ACCOUNT_ADDRESS,
        Flags: 0,
        TakerGets: {
          currency: process.env.CURRENCY,
          issuer: process.env.CURRENCY_ISSUER,
          value: currencyAmount
        },
        TakerPays: xrpl.xrpToDrops(xrpAmount)
      }, { wallet: this.wallet })
      console.log(`Succcess buy order. xrpAmount: ${xrpAmount}, usdAmount: ${currencyAmount}`);
    } catch (error) {
      console.error('Failed to request buy order:', error);
      // throw error;
    }
  }
  // 売り注文をオーダーする
  async sellOrder(xrpAmount, currencyAmount) {
    try {
      await this.client.submit({
        TransactionType: "OfferCreate",
        Account: process.env.XRPL_ACCOUNT_ADDRESS,
        Flags: 0,
        TakerGets: xrpl.xrpToDrops(xrpAmount),
        TakerPays: {
          currency: process.env.CURRENCY,
          issuer: process.env.CURRENCY_ISSUER,
          value: currencyAmount
        }
      }, { wallet: this.wallet })
      console.log(`Succcess sell order. xrpAmount: ${xrpAmount}, usdAmount: ${currencyAmount}`);
    } catch (error) {
      console.error('Failed to request sell order:', error);
      // throw error;
    }
  }
}
module.exports = XRPLClient;