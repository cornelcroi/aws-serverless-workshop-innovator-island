// Library documentation: https://www.npmjs.com/package/jimp

const AWS = require('aws-sdk')
AWS.config.update({ region: process.env.AWS_REGION })
const s3 = new AWS.S3()
const Jimp = require('jimp')

// Wrapping promise around Jimp callback
const getBuffer = function(image) {
  return new Promise((resolve, reject) => {
    image.getBuffer(Jimp.MIME_PNG, (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  })
}

// Module 3 - Compositing
// This function composites three images - a background, the green screen photo and a branding frame.
// The composited image is put back to S3 in the final bucket.

exports.handler = async (event) => {

  const params = {
    Bucket: event.Records[0].s3.bucket.name,
    Key: event.Records[0].s3.object.key
  }

  // Load greenscreen person foreground (already resized to 600w x 800h in previously Lambda function)
  const s3Object = await s3.getObject(params).promise()
  const foreground  = await Jimp.read(s3Object.Body)

  // Select random background (1-4 available)
  const random = Math.ceil(Math.random()*4)
  const background = await Jimp.read( `https://d15l97sovqpx31.cloudfront.net/images/composite-bg${random}.png`) // theme park background
  const branding = await Jimp.read('https://d15l97sovqpx31.cloudfront.net/images/edge-decor-600x1000.png') // branding frame

  // Composite background with greenscreen foreground (foreground in front - added vertical offset of 130px)
  let composited = await background.composite(foreground, 0, 130, { mode: Jimp.BLEND_SOURCE_OVER })

  // Composite with branding frame (branding in front)
  composited = await composited.composite(branding, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER })

  // Save to S3
  const outParams = {
    Bucket: process.env.OUTPUT_BUCKET_NAME,
    Key: params.Key.replace('.png', '.jpg'),  
    ContentType: 'image/jpeg',
    Body: await getBuffer(composited),
    ACL: 'public-read'
  }
  console.log(outParams)
  console.log(await s3.putObject(outParams).promise())
  return
}
