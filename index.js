// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm')
            .subClass({ imageMagick: true }); // Enable ImageMagick integration.
var util = require('util');

// get reference to S3 client 
var s3 = new AWS.S3();

var MAX_WIDTH  = 480;
var MAX_HEIGHT = 270;
 
var eltr = new AWS.ElasticTranscoder({
apiVersion: '2012-09-25',
region: 'eu-west-1'
});

var pipelineId = '1446810401571-3sx105';

var webPreset = '1446808408499-2nqnfl';
var AudioPreset = '1351620000001-300040';

exports.handler = function(event, context) {
	// Read options from the event.
	console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
	var srcBucket = event.Records[0].s3.bucket.name;
	var srcKey    = event.Records[0].s3.object.key;
	var dstBucket = srcBucket + "resized";
	var dstKey    = "resized-" + srcKey;



   if (srcBucket == dstBucket) {
		console.error("Destination bucket must not match source bucket.");
		return;
	}

	var typeMatch = srcKey.match(/\.([^.]*)$/);
	if (!typeMatch) {
		console.error('unable to infer video type for key ' + srcKey);
		return;
	}
	var videoType = typeMatch[1];
	if (videoType != "avi" && videoType != "mp4" && videoType != "mov") {
		console.log('skipping non-video ' + srcKey);
		//return;
	} else {
	  var FileName = srcKey.match(/\/(\d+)/);
      var File = FileName[1];
      var UserDir = srcKey.match(/^([^\/]+)/);
      var Dir = UserDir[1];
      console.log("Show Filename:",File);
      s3.getObject({
		Bucket: srcBucket,
		Key: srcKey
	   },
	   function (err) {
			if (err) {
				console.error(
					'Unable to transcode ' + srcBucket + '/' + srcKey +
					' due to an error: ' + err
				);
			} else {
				console.log(
					'Successfully accessed ' + srcBucket + '/' + srcKey
				);
				sendVideoToET(srcKey,Dir,File);
			}

			//context.done();
		}
    );
   }


var audioType = typeMatch[1];
	if (audioType != "ogg" && audioType != "wma" && audioType != "mp3" && audioType != "wav") {
		console.log('skipping non-audio ' + srcKey);
		//return;
	} else {
	  var FileName = srcKey.match(/\/(\d+)/);
      var File = FileName[1];
      var UserDir = srcKey.match(/^([^\/]+)/);
      var Dir = UserDir[1];
      console.log("Show Filename:",File);
      s3.getObject({
		Bucket: srcBucket,
		Key: srcKey
	   },
	   function (err) {
			if (err) {
				console.error(
					'Unable to transcode ' + srcBucket + '/' + srcKey +
					' due to an error: ' + err
				);
			} else {
				console.log(
					'Successfully accessed ' + srcBucket + '/' + srcKey
				);
				sendaudioToET(srcKey,Dir,File);
			}

			//context.done();
		}
    );
   }



   var imageType = typeMatch[1];
   if (imageType != "jpeg" && imageType != "png") {
		console.log('skipping non-image ' + srcKey);
		return;
	}

	// Download the image from S3, transform, and upload to a different S3 bucket.
	async.waterfall([
		function download(next) {
			// Download the image from S3 into a buffer.
			s3.getObject({
					Bucket: srcBucket,
					Key: srcKey
				},
				next);
			},
		function tranform(response, next) {
			gm(response.Body).size(function(err, size) {
				// Infer the scaling factor to avoid stretching the image unnaturally.
				var scalingFactor = Math.min(
					MAX_WIDTH / size.width,
					MAX_HEIGHT / size.height
				);
				var width  = scalingFactor * size.width;
				var height = scalingFactor * size.height;

				// Transform the image buffer in memory.
				this.resize(width, height)
					.toBuffer(imageType, function(err, buffer) {
						if (err) {
							next(err);
						} else {
							next(null, response.ContentType, buffer);
						}
					});
			});
		},
		function upload(contentType, data, next) {
			// Stream the transformed image to a different S3 bucket.
			s3.putObject({
					Bucket: dstBucket,
					Key: dstKey,
					Body: data,
					ContentType: contentType
				},
				next);
			}
		], function (err) {
			if (err) {
				console.error(
					'Unable to resize ' + srcBucket + '/' + srcKey +
					' and upload to ' + dstBucket + '/' + dstKey +
					' due to an error: ' + err
				);
			} else {
				console.log(
					'Successfully resized ' + srcBucket + '/' + srcKey +
					' and uploaded to ' + dstBucket + '/' + dstKey
				);
			}

			context.done();
		}
	);


};

function sendVideoToET(key,Dir,File){

   console.log('Sending ' + key + ' to ET with' + File);

   var params = {

   PipelineId: pipelineId,
   OutputKeyPrefix: 'done/'.Dir,
   Input: {
      Key: key,
      FrameRate: 'auto',
      Resolution: 'auto',
      AspectRatio: 'auto',
      Interlaced: 'auto',
      Container: 'auto'
    },

    Output: {
      Key: key + '.mp4',
      ThumbnailPattern: Dir + '/'  + File + '-' + 'thumbs-{count}',
      PresetId: webPreset,
      Rotate: 'auto'
    }
 };
// move files in the same bucket to a done directory
eltr.createJob(params, function (err, data) {

  if (err) {
    console.log('Failed to send new video ' + key + ' to ET');
    console.log(err);
    console.log(err.stack)

  } else {
    console.log('Error');
    console.log(data);

  }

//context.done(null,”);

});

// recieve notification that the job is done and rename the directory in the resized bucket with the user name


}

function sendaudioToET(key,Dir,File){

   console.log('Sending ' + key + ' to ET with' + File);

   var params = {

   PipelineId: pipelineId,
   OutputKeyPrefix: 'done/'.Dir,
   Input: {
      Key: key,
      FrameRate: 'auto',
      Resolution: 'auto',
      AspectRatio: 'auto',
      Interlaced: 'auto',
      Container: 'auto'
    },

    Output: {
      Key: key + '.mp3',
     // ThumbnailPattern: Dir + '/'  + File + '-' + 'thumbs-{count}',
      PresetId: AudioPreset,
      Rotate: 'auto'
    }
 };
// move files in the same bucket to a done directory
eltr.createJob(params, function (err, data) {

  if (err) {
    console.log('Failed to send new video ' + key + ' to ET');
    console.log(err);
    console.log(err.stack)

  } else {
    console.log('Error');
    console.log(data);

  }

//context.done(null,”);

});

// recieve notification that the job is done and rename the directory in the resized bucket with the user name


}
