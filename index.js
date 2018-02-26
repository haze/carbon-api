const rm = require('rimraf');
const sleep = require('sleep');
const path = require("path");
const fs = require('fs');
const bp = require('body-parser')
const express = require('express')
const app = express()
const pup = require('puppeteer')
const argv =
    require('yargs')
        .command('serve [path] [port]', 'start the server', (yargs) => {
            yargs.positional('port', {
                describe: 'port to bind',
                default: '8080'
            });
            yargs.positional('path', {
                describe: 'where to cache files',
                default: './'
            });
        }).argv;
// add download command sometime later?

app.use(bp.json());

const CARBON_THEME_SELECTOR = '.jsx-2015459824';
const CARBON_DL_BUTTON_SELECTOR = 'button.jsx-3445587207:nth-child(2)';
const CARBON_TEXT_SELECTOR = '.CodeMirror-code';

argv.path = path.resolve(argv.path);

function error_json(why) {
    return {
        'error': true,
        'why': `missing ${why.join(', ')} json key${why.length > 1 ? 's' : ''}.`
    };
}

// Thanks, (Thinker..?)
function arr_diff(a1, a2) {

    var a = [], diff = [];

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true;
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]];
        } else {
            a[a2[i]] = true;
        }
    }

    for (var k in a) {
        diff.push(k);
    }

    return diff;
}

function hash_current() {
    return Buffer.from(Date.now().toString()).toString('base64');
}


// Thanks, slavafomin (I'm very lazy.)
function contains_all(superset, subset) {
    if (0 === subset.length) {
        return false;
    }
    return subset.every(function (value) {
        return (superset.indexOf(value) >= 0);
    });
}

app.get('/', (req, resp) => {
    resp.send('hi. haze (haze.sh) owns this website.');
});


async function clear_text_element(page) {
    await page.keyboard.down('Meta');
    await page.keyboard.press('a');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
}

function create_folder(name) {
    if (!fs.existsSync(name)) {
        fs.mkdirSync(name);
    }
}

function delete_folder() {
     if (fs.existsSync(name)) {
        fs.unlink(name);
    }
}


function build_url_params(json) {
    var buf = '?';
    let keys = Object.keys(json);
    let e_keys = Object.keys(param_map);
    for(var i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (key in param_map) {
            if(!(buf == "?"))
                buf += "&";
            buf += `${param_map[key].url}=${json[key]}`
        }
    }
    for(var i = 0; i < e_keys.length; i++) {
        let key = e_keys[i];
        if  (key in keys) {
           if(!(buf == "?"))
                buf += "&";
            buf += `${param_map[key].url}=${param_map[key].value}`
        }
    }
    return buf;
}


// work on later
// 	"drop_shadow_y_offset": 5, [needs puppet]
// 	"drop_shadow_blur_radius": 5, [needs puppet]
// 	"window_theme": 1, [needs puppet]
// 	"font_family": "Hack", [needs puppet]
// 	"font_size": 32, [needs puppet]

var param_map = {}
function add_default_params() { // todo: make true to website
    add_param('background_color', 'bg', 'rgb(255, 255, 255)');
    add_param('language', 'l', 'auto');
    add_param('drop_shadow', 'ds', true);
    add_param('padding_horiz', 'ph', '50px');
    add_param('padding_vert', 'pv', '50px');
    add_param('auto_adjust_width', 'wa', true);
    add_param('line_numbers', 'ln', true);
    add_param('window_controls', 'wc', false);
    
}
function add_param(json_name, url_name, value) {
    param_map[json_name] = {
        url: url_name,
        val: value
    };
}

add_default_params();


function download_image(json) {
    let text = json.text;
    let hash = hash_current();
    let anchor_path = path.join(argv.path, hash);
    return new Promise((res, rej) => {
        (async () => {
            let browser = await pup.launch();
            let page = await browser.newPage();
            create_folder(anchor_path)
            await page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: anchor_path
            })
        
            let built_url = `https://carbon.now.sh/${build_url_params(json)}`
            
            await page.goto("https://carbon.now.sh/");
            await page.click(CARBON_TEXT_SELECTOR);
            await clear_text_element(page);
            await page.keyboard.type(text);
            await page.click(CARBON_DL_BUTTON_SELECTOR);
            while (!fs.existsSync(path.join(anchor_path, 'carbon.png'))) {
                sleep.sleep(1);
            }
            await page.close();
            res(anchor_path);
        })();
    });
}

app.post('/img', (req, resp) => {
    let req_keys = ['theme', 'text'];
    let keys = Object.keys(req.body);
    let diff = arr_diff(keys, req_keys);
    if (!contains_all(keys, req_keys)) {
        resp.send(error_json(diff));
        return;
    }
    download_image(req.body).then(name => {
        resp.sendFile(path.join(name, 'carbon.png'));
        rm(name, () => {});
    });
});

app.listen(argv.port, (err) => {
    if (err) {
        return console.log('something bad happened ', err)
    }
    console.log(`server is listening on :${argv.port}`)
})