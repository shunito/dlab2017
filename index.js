const fs = require('fs');
const assert = require('assert');
const puppeteer = require('puppeteer');
const util = require('util');
const pathUtil = require('path');

// Settings
const downloadPath = './build';
const inputPath = './ginga';
const creator = "銀河鉄道の夜";
const title = "宮沢賢治"
let files = [];

/*
const files = [
    'ginga/ddconv.yml',
    'ginga/cover.png',
    'ginga/00_gingatetsudono_yoru.md',
    'ginga/01_gingatetsudono_yoru.md',
    'ginga/02_gingatetsudono_yoru.md',
    'ginga/03_gingatetsudono_yoru.md',
    'ginga/04_gingatetsudono_yoru.md',
    'ginga/05_gingatetsudono_yoru.md',
    'ginga/06_gingatetsudono_yoru.md',
    'ginga/07_gingatetsudono_yoru.md',
    'ginga/08_gingatetsudono_yoru.md',
    'ginga/09_gingatetsudono_yoru.md',
    'ginga/10_gingatetsudono_yoru.md'
];
*/

const readFiles = async()=>{

    return new Promise((resolve, reject) => {
        fs.readdir( inputPath, function(err, dir){
            if (err) {
                reject(err);
            }
        
            let list = dir.map(function(elm) {
                return pathUtil.join( inputPath, elm);
            });
            files = list.filter(function(file){
                console.log( 'File: ' , file );
                return fs.statSync(file).isFile();
            });
            //console.log( files );
            resolve(files);
        });
    });

}


const waitDownloadComplete = async(path, waitTimeSpanMs = 1000, timeoutMs = 60 * 1000) => {
    return new Promise((resolve, reject) => {

        const wait = (waitTimeSpanMs, totalWaitTimeMs) => setTimeout(
            () => isDownloadComplete(path).then(
                (completed) => {
                    if (completed) {
                        resolve();
                    } else {
                        const nextTotalTime = totalWaitTimeMs + waitTimeSpanMs;
                        if (nextTotalTime >= timeoutMs) {
                            reject('timeout');
                        }

                        const nextSpan = Math.min(
                            waitTimeSpanMs,
                            timeoutMs - nextTotalTime
                        );
                        wait(nextSpan, nextTotalTime);
                    }
                }
            ).catch(
                (err) => {
                    reject(err);
                }
            ),
            waitTimeSpanMs
        );

        wait(waitTimeSpanMs, 0);
    });
}

const isDownloadComplete = async(path) => {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            } else {
                for (let file of files) {
                    // .crdownloadがあればダウンロード中のものがある
                    if (/.*\.crdownload$/.test(file)) {
                        resolve(false);
                        return;
                    }
                }
                resolve(true);
            }
        });
    });
}


(async() => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();

    let fname = '';
    
    await page._client.send(
        'Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        }
    );

    await page.goto('https://conv.denshochan.com/', {
        waitUntil: "networkidle2"
    });
    await page.screenshot({
        path: 'screenshot/conv-denshochan.png'
    });

    await page.type("#form_creator", creator);
    await page.type("#form_title", title);

    page.on('response', res => {
        (async() => {
//            console.log( res );
            const headers = res.headers;
            const reg = new RegExp('filename="(.+)"');

            if( res.ok ){
                let contentDisposition = headers['content-disposition'];
                //console.log("content Disposition:" , contentDisposition);
                let content = contentDisposition.match( reg );
                if( content ) {
                    fname = pathUtil.join( downloadPath, content[1]);
                    //console.log( "Download:", fname );
                }
            }
        })();
    });

    const fileUploaders = await page.$("input[type=file]");

    let input_creator = await page.$eval('#form_creator', el => el.value);
    let input_title = await page.$eval('#form_title', el => el.value);

    console.log("Headless でんでんコンバーター");
    console.log("タイトル：", title);
    console.log("製作者：" ,creator);
    console.log("変換実行");

    await readFiles();
    fileUploaders.uploadFile(...files);
    
    await page.screenshot({
        path: 'screenshot/conv-denshochan2.png'
    });

    await page.click('button[name="submit"]');
    await page.waitFor(10000);

    await waitDownloadComplete(downloadPath)
        .catch((err) => console.error(err));

    await browser.close();
    console.log("変換完了:" , fname );

})();