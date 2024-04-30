const XRPLClient = require('./XRPLClient');
const dotenv = require('dotenv');
const envFile = `.env.${process.env.NODE_ENV.trim()}`;
dotenv.config({ path: envFile });
const client = new XRPLClient();
let isRunning = false;

async function main() {
    try {
        await client.connect();
        await run();
        // 20秒おきにrun関数が実行されます
        setInterval(async function (){
            await run();
        }, 1000 * 20);
    } catch (error) {
        console.error(error);
    }
}

async function run() {

    if (isRunning) {
        return;
    }

    try {
        isRunning = true;

        // 最安値の売り注文を取得
        const askOrderBook = await client.getAskOrderBook();
        const askValue = parseFloat(askOrderBook?.offers[0]?.quality * 1000000).toFixed(12);
        console.log(`Ask Price: ${askValue}`);

        // 最高値の買い注文を取得
        const bitOrderBook = await client.getBitOrderBook();
        const bitValue = parseFloat(1 / bitOrderBook?.offers[0]?.quality * 1000000).toFixed(12);
        console.log(`Bit Price: ${bitValue}`);

        // XRPのレート
        const xrpRate = parseFloat(askValue / 2 + bitValue / 2);
        console.log(`XRP Rate: ${xrpRate}`);

        // XRPの保有量を取得
        const xrpBalance = await client.getXrpBalance();
        console.log(`XRP Balance: ${xrpBalance}`)

        // トークン保有量を取得
        const tokenBalance = parseFloat(await client.getAvailableTokenBalance());
        console.log(`USD Balance: ${tokenBalance}`);

        // 自分の全ての注文を取得
        const myOrder = await client.getOrders();

        // (XRP/USD,USD/XRP)ペアのみを取得
        const offers = currentOffers(myOrder);
        if (offers.length > 0) {
            await cancelOrder(tokenBalance, offers);
        }
        
        // 複数注文に変更したい場合などはここの中のコードを上手く修正してください。
        if (await isOrderCreatable()) {
            console.log("注文開始");
            {
                // XRPの売り注文
                let workRate = xrpRate;
                let totalBarance = (xrpBalance * xrpRate) + tokenBalance;
                let xrpDiff = (xrpBalance * xrpRate) - (totalBarance / 1.5);
                const e = 0.6;
                workRate = round(workRate * (1 + e / 100), 6);
                let workDifference = ((((xrpBalance * workRate) + tokenBalance) - totalBarance) / 1.5) + (xrpDiff / 2);
                if (workDifference > 0 && (workDifference / workRate > 0.0001)) {
                    const lot = round(workDifference / workRate, 6);
                    if (lot * workRate > totalBarance * 0.00095) {
                        await client.sellOrder(lot.toString(), round(lot * workRate, 6).toString());
                    }
                }
            }
            {
                // XRPの買い注文
                let workRate = xrpRate;
                let totalBarance = (xrpBalance * xrpRate) + tokenBalance;
                let xrpDiff = (totalBarance / 1.5) - (xrpBalance * xrpRate);
                const e = 0.6;
                workRate = round(workRate / (1 + e / 100), 6);
                let workDifference = ((totalBarance - ((xrpBalance * workRate) + tokenBalance)) / 1.5) + (xrpDiff / 2);
                if (workDifference < tokenBalance && (workDifference / workRate > 0.0001)) {
                    const lot = round(workDifference / workRate, 6);
                    if (lot * workRate > totalBarance * 0.00095) {
                        await client.buyOrder(lot.toString(), round(lot * workRate, 6).toString());
                    }
                }
            }
        }
    } finally {
        isRunning = false;
    }
}

let tmpTokenBalance = 0;
async function cancelOrder(tokenBalance, offers) {
    // USDの保有量が変わった場合か、指定された時間(分)に注文をリセット
    if (tmpTokenBalance != tokenBalance || isResetOrder()) {
        for (const offer of offers) {
            await client.cancelOrder(offer);
        }
        tmpTokenBalance = tokenBalance;
    }
}

async function isOrderCreatable() {
    const myOrder = await client.getOrders();
    const offers = currentOffers(myOrder);
    return offers.length == 0;
}

function currentOffers(order) {
    let offerReturnObj = [];
    if (order.offers != undefined) {
        for (let j = 0; j < order.offers.length; j++) {
            if (typeof order.offers[j].taker_gets == "object") {
                if (order.offers[j].taker_gets.currency == process.env.CURRENCY &&
                    order.offers[j].taker_gets.issuer == process.env.CURRENCY_ISSUER) {
                    offerReturnObj.push(order.offers[j])
                }
            } else if (typeof order.offers[j].taker_pays == "object") {
                if (order.offers[j].taker_pays.currency == process.env.CURRENCY &&
                    order.offers[j].taker_pays.issuer == process.env.CURRENCY_ISSUER) {
                    offerReturnObj.push(order.offers[j])
                }
            }
        }
    }
    return offerReturnObj;
}

function isResetOrder() {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes % process.env.RESET_ORDER_TIME === 0;
}

function round(num, del) {
    if (num == 0) {
        return 0
    } else {
        return Math.round(num * Math.pow(10, del)) / Math.pow(10, del)
    }
}

main();