// AUTHOR: Yishi Guo
// DATE: 22/11/2016
// A Progress Checker for NZQA IQA.

var request = require('request');
var cheerio = require('cheerio');
var colors = require('colors');
var luosimao = require('node-sms-luosimao');
var argv = require('optimist')
    .usage('Usage: $0 --number [number] --birth [birth]')
    .alias('number', 'n')
    .alias('birth', 'b')
    .alias('luosimao', 'l')
    .alias('phones', 'o')
    .alias('sign', 's')
    .describe('number', 'The feedback check number, e.g. BEAC/012316/0011')
    .describe('birth', 'The birthday, e.g. DD/MM/YYYY')
    .describe('luosimao', 'The api key of Luosimao (SMS provider)')
    .describe('phones', 'The phone numbers of SMS receiver, e.g. 1111,2222,3333')
    .describe('sign', 'The sign of SMS')
    .demand(['number', 'birth'])
    .argv;

request = request.defaults({
    jar: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36'
    }
});

var main_url = 'https://www.visaservices.co.in/NewZealand-China-Tracking/TrackingParam.aspx?P=51HHvkv1thMznsrS3VG2Cw==';
var post_url = 'https://www.visaservices.co.in/NewZealand-China-Tracking/TrackingParam.aspx?P=51HHvkv1thMznsrS3VG2Cw==';
var number = argv.number;
var birth = argv.birth;
var phones = [];

function check_status(num, birth) {
    request(main_url, function (err, response, body) {
        if (err) {
            console.log(err);
            return;
        }
        var $ = cheerio.load(body);
        var viewstate = $('#__VIEWSTATE').val();
        var eventvalidation = $('#__EVENTVALIDATION').val();

        var R2 = num.split('/');

        var postdata = {
            __LASTFOCUS: '',
            __EVENTTARGET: '',
            __EVENTARGUMENT: '',
            __VIEWSTATE: viewstate,
            ctl00$CPH$txtR2Part1: R2[0],
            ctl00$CPH$txtR2Part2: R2[1],
            ctl00$CPH$txtR2Part3: R2[2],
            ctl00$CPH$txtDOB$txtDate: birth,
            ctl00$CPH$btnDOB: 'Submit',
            __EVENTVALIDATION: eventvalidation
        };

        // console.log('viewstate', viewstate);
        // console.log('eventvalidation', eventvalidation);
        console.log('postdata', postdata);

        request({
            method: 'POST',
            url: post_url,
            form: postdata
        }, function (err, response, body) {

            if (err) {
                console.log(err, response.statusCode);
                return;
            }
            var $ = cheerio.load(body);
            var text = $('.fnstatus font').text();

            // console.log('post back body', body);
            console.log('text', text);
            if (text) {
                send_sms(text);
            }
        });
    });
}


function send_sms(status) {
    var msg = '';
    var date = new Date();
    msg += number + '-' + birth + ', ' + status;
    msg += ', date: ' + date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
    msg += '【' + argv.sign + '】';
    console.log(msg.white.inverse);

    phones.forEach(function(phone) {
        luosimao.send(phone, msg, function(err, result, body) {
            console.log('send sms', phone, msg, body);
        });
    });
}


function init_sms() {
    if (argv.luosimao) {
        luosimao.key = argv.luosimao;
    }
    if (argv.phones) {
        console.log('phones', argv.phones);
        phones = (argv.phones + '').split(',');
    }
}

init_sms();

console.log('number', number);
console.log('birth', birth);

check_status(number, birth);