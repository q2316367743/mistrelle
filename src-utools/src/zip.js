var AdmZip = require("adm-zip");
var fs = require("fs");
var path = require("path");

module.exports = {
  /**
   * 压缩方法，传入路径数组，和zip 路径，将路径的文件/文件夹压缩到指定路径
   */
  compress: function (zipPath, paths) {
    var zip = new AdmZip();
    paths.forEach(function (item) {
      var stats = fs.statSync(item);
      if (stats.isDirectory()) {
        zip.addLocalFolder(item, path.basename(item));
      } else {
        zip.addLocalFile(item);
      }
    });
    return zip.writeZipPromise(zipPath)
  },
  /**
   * 解压方法，传入 zip 路径和解压目录，将 zip 的内容解压到指定目录下，如果目标目录不存在，则自动创建
   */
  extract: function (zipPath, targetDir) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    var zip = new AdmZip(zipPath);
    return zip.extractAllToAsync(targetDir, true);
  },
};
