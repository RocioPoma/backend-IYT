const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: (req, file, callBack) => {
      callBack(null, 'uploads/img')
  },
  filename: (req, file, callBack) => {
      callBack(null, `${Date.now()}-${file.originalname}`)
  }
});

module.exports = multer({ storage: storage })
//exports.multer = multer({ storage: storage })
//export default multer({storage});
//exports.upload=upload.single('imagen')

