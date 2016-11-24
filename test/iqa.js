// AUTHOR: Yishi Guo
// DATE: 22/11/2016
// A Progress Checker for NZQA IQA.

var request = require('request');
var cheerio = require('cheerio');
var colors = require('colors');
var luosimao = require('node-sms-luosimao');
var argv = require('optimist')
    .usage('Usage: $0 --username [username] --password [password] --id [applicant id] --num [application id]')
    .alias('username', 'u')
    .alias('password', 'p')
    .alias('id', 'i')
    .alias('num', 'n')
    .alias('luosimao', 'l')
    .alias('phones', 'o')
    .alias('sign', 's')
    .describe('username', 'The login username (email)')
    .describe('password', 'The login password')
    .describe('id', 'The applicant ID, e.g. 285000')
    .describe('num', 'The application ID, e.g. 1, 2, 3')
    .describe('luosimao', 'The api key of Luosimao (SMS provider)')
    .describe('phones', 'The phone numbers of SMS receiver, e.g. 1111,2222,3333')
    .describe('sign', 'The sign of SMS')
    .demand(['username', 'password', 'id', 'num'])
    .argv;

request = request.defaults({
    jar: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36'
    }
});


var login_url = 'https://secure.nzqa.govt.nz/for-qrs/qual-eval/qrs/loginsubmit.do';
var applicants_list_url = 'https://secure.nzqa.govt.nz/for-qrs/qual-eval/qrs/index.do';
var host_url = 'https://secure.nzqa.govt.nz';
var username = argv.username;
var password = argv.password;
var targetApplicantId = argv.id;
var targetApplicationId = argv.num;
var loginFlag = 'for-qrs/qual-eval/qrs';
var phones = [];

function login(username, password, cb) {
    var options = {
        method: 'POST',
        url: login_url,
        form: {
            email: username,
            password: password,
            submit: 'Login'
        }
    };

    request(options, function(err, response, body) {
        if (err) {
            console.log(err, response.statusCode, body);
            cb(err, false);
        }
        var location = response.headers.location;
        var statusCode = response.statusCode;
        //console.log('location', location, 'statusCode', statusCode);
        if (location && location.includes(loginFlag)) {
            //console.log('login ok!'.green.inverse);
            return cb(null, true);
        }

        cb(null, false);
    });
};

function get_applicants_list(targetId) {
    request(applicants_list_url, function(err, response, body) {
        if (err) {}
        //console.log('body', body);
        var $ = cheerio.load(body);
        var list = $('.tableData tr');
        //console.log('list length', list.length);
        if (list.length > 1) {
            list = list.not(':first-child');
            var output = 'Found ' + list.length + ' applicant(s)';
            console.log(output.blue.underline.bold);
            list.each(function(idx, ele) {
                
                var tds = $(this).children('td');
                var id = $(tds[0]).text().trim();
                var name = $(tds[1]).text().trim();
                var type = $(tds[2]).text().trim();
                var time = $(tds[3]).text().trim();

                var output = '#' + idx + ' / ' + id + ' / ' + name + ' / ' + type + ' / ' + time;

                if (id == targetId) {
                    console.log(output.blue.bold);
                    var url = $(tds[4]).children('a').attr('href');
                    //console.log('url', url);
                    get_applications_list(host_url + url, targetApplicationId);
                } else {
                    console.log(output.blue);
                }
            });
        }
    });
};

function get_applications_list(url, targetId) {
    request(url, function(err, response, body) {
        if (err) {}
        //console.log('body', body);
        var $ = cheerio.load(body);
        var list = $('.tableData tr');
        //console.log('list length', list.length);
        if (list.length > 1) {
            list = list.not(':first-child');
            var output = 'Found ' + list.length + ' application(s)';
            console.log(output.cyan.underline.bold);
            list.each(function(idx, ele) {
                
                var tds = $(this).children('td');
                var id = $(tds[0]).text().trim();
                var type = $(tds[1]).text().trim();
                var qualification = $(tds[2]).text().trim();
                var status = $(tds[3]).text().trim();
                var submitted = $(tds[4]).text().trim();

                var output = '#' + idx + ' / ' + id + ' / ' + type + ' / ' + qualification + ' / ' + status + ' / ' + submitted;

                if (id == targetId) {
                    console.log(output.cyan.bold);
                    var url = $(tds[5]).children('a').attr('href');
                    //console.log('url', url);
                    get_application_status(host_url + url);
                } else {
                    console.log(output.cyan);
                }
            });
        }
    });
}

function get_application_status(url) {
    request(url, function(err, response, body) {
        if (err) {}
        //console.log('body', body);
        var $ = cheerio.load(body);
        var progress = $('.tableDetails tr:nth-child(3) td:last-child');
        var text = $(progress).text();
        //console.log('text', text);
        var items = $(progress).children('span');
        if (items.length > 0) {
            var output = 'Application Status';
            console.log(output.magenta.underline.bold);
            var inProgress = false;
            items.each(function(idx, ele) {
                var status = $(ele).attr('class');
                var name = $(ele).text().trim();
                name = name.replace(/>\s*/, '');
    
                var output = idx + ' / ' + name + ' / ';
                switch(status) {
                    case 'done':
                        status = status.green.inverse;
                        output = output.green;
                        break;
                    case 'inprogress':
                        status = status.cyan.inverse;
                        output = output.cyan;
                        inProgress = name;
                        break;
                    case 'todo':
                        status = status.yellow.inverse;
                        output = output.yellow;
                        break;
                }
                output += status;
                console.log(output);
            });
            var msg = '';
            if (inProgress) {
                msg = inProgress + ' in progress';
                send_sms(msg);
            } 
        }
    });
};

function send_sms(status) {
    var msg = '';
    msg += targetApplicantId + '-' + targetApplicationId + ', current status: ' + status + '【' + argv.sign + '】';
    console.log(msg.white.inverse);

    phones.forEach(function(phone) {
        luosimao.send(phone, msg, function(err, result, body) {
            console.log('send sms', phone, msg, body);
        });
    });
};

function login_callback(err, isLogin) {
    //console.log('login callback', err, isLogin);
    if (err || !isLogin) {
        console.log('LOGIN ERROR!'.red.inverse);
    }
    if (isLogin) {
        console.log('LOGIN OK!'.green.inverse);
        get_applicants_list(targetApplicantId);
    }
};

function init_sms() {
    if (argv.luosimao) {
        luosimao.key = argv.luosimao;
    }
    if (argv.phones) {
        console.log('phones', argv.phones);
        phones = (argv.phones + '').split(',');
    }
};

init_sms();

login(username, password, login_callback);
