//const request = require('request-promise')
const fs = require('fs'),
      http = require('http'),
      sRequest = require('sync-request'),
      sleep = require('system-sleep')

const host = 'www.cloudandleer.com';
const hostPath = 'pi_kiosk';
const localPath = '/tmp';

var data = {};

function getEtag(num) {
  res = sRequest('HEAD', 'http://' + host + '/' + hostPath + '/' + num + '.png');

  if (res.statusCode == 200) {
    return res.headers.etag;
  } else {
    throw new Error('bad request');
  }
}

function downloadImage(num) {
  var url = 'http://' + host + '/' + hostPath + '/' + num + '.png';
  var options = {
    encoding: null
  };

  var file = fs.createWriteStream(localPath + '/tmp' + num + '.png');
  res = sRequest('GET', url, options);
  file.write(res.getBody());
  /*
  http.get(options, (res) => {
    try {
      res.pipe(file);
    } catch (err) {
      console.log('Image download err: tmp' + num + '.png');
    }
  });
  */

  fs.renameSync(localPath + '/tmp' + num + '.png', localPath + '/' + num + '.png');
}

function getImages() {
  for (var i = 0; i < 100; i++) {
    var num = i.toLocaleString('en', {minimumIntegerDigits: 2});
    try {
      var etag = getEtag(num, etag);
      if (data[num]) {
	if (data[num] != etag) {
        	console.log('UPDATE: ' + num + ' -- ' + etag);
		data[num] = etag;
		downloadImage(num);
	}
      } else {
        console.log('NEW: ' + num + ' -- ' + etag);
        downloadImage(num);
        data[num] = etag;
      }
    } catch (err) {
      // stop looking for images
      break;
    }
  }

  return data;
}

var repeat = true;
if (process.argv.length > 2 && process.argv[2] == 'once') {
	repeat = false;
}

do {
	console.log('checking...');
	getImages();
	if (repeat) {
		sleep(60 * 1000);
	}
} while (repeat);
