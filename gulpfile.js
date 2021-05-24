const {
  updateCssVersion,
  updateJsVersion,
  srcPathFixer,
  syncMapFile
} = require('./updateVersion.js')

const {
  MAPFILE_PATH,
} = require('./setting')
const { stfp_config } = require('./setting')
const gulp = require(`gulp`)
const less = require(`gulp-less`)
const minifyCSS = require(`gulp-minify-css`)
const concat = require(`gulp-concat`)
const minify = require(`gulp-minify`)
const autoprefixer = require(`gulp-autoprefixer`)
const Client = require('ssh2-sftp-client')
const sftp = new Client()
/**
 * slevakupon.cz
 * kuponkode.hu
 * 测试环境无法引入css和js需要修改文件名才能正确引入,上线前恢复文件名
 */
/** promocode.co.id 
 * 个别站点由于原文件名与域名不一致需要手动执行同步操作
*/
// **********************************
const originSite = "promocodes.tw"
// **********************************
const watchSite = srcPathFixer(originSite)
//***********************************
const isAuto = 1
//***********************************
sftp
  .connect(stfp_config)
  .then(() => {
    syncMapFile(originSite, MAPFILE_PATH, sftp)
  })
  .catch(err => {
    log(err, 'catch error')
  })


if (originSite == 'ozsavingspro.com') {
  gulpForAU()
} else if (originSite == 'noscodespromo.com') {
  gulpForFr()
} else {
  launchGulp(watchSite)
}

function launchGulp(site) {
  gulp.task(`style`, function () {
    gulp
      .src(`./src/${site}/less/${site}.less`)
      .pipe(less())
      .pipe(
        autoprefixer(
          `last 2 version`,
          `safari 5`,
          `ie 8`,
          `ie 9`,
          `opera 12.1`,
          `ios 6`,
          `android 4`
        )
      )
      .on(`error`, function (e) {
        console.log(e)
      })
      .pipe(minifyCSS())
      .pipe(gulp.dest(`./css/`))
  })
  gulp.task(`uploadCss`, async () => {
    await updateCssVersion(originSite)
  })
  gulp.task(`scripts`, function () {
    gulp
      .src([
        `./src/${site}/js/jquery.2.1.0.min.js`,
        `./src/${site}/js/jquery-ui.min.js`,
        `./src/${site}/js/jquery.cookie.js`,
        `./src/${site}/js/jquery.lazyload.min.js`,
        `./src/${site}/js/clipboard.min.js`,
        `./src/${site}/js/swiper.min.js`,
        `./src/${site}/js/casite.js`,
        `./src/${site}/js/masonry.pkgd.min.js`
      ])
      .pipe(concat(`${site}.js`, {
        newLine: `;`
      }))
      .pipe(
        minify({
          ext: {
            src: `-debug.js`,
            min: `.js`,
          },
        })
      )
      .pipe(gulp.dest(`./js/`))
  })
  gulp.task(`uploadJs`, async () => {
    await updateJsVersion(originSite)
  })
  gulp.task(`watch`, function () {
    gulp.watch(`src/${site}/less/*.less`, [`style`])
    gulp.watch(`src/${site}/js/*.js`, [`scripts`])
    isAuto && gulp.watch(`css/${site}.css`, [`uploadCss`])
    isAuto && gulp.watch(`js/${site}.js`, [`uploadJs`])
  })
  gulp.task(`default`, [`watch`])
}

function gulpForAU() {
  gulp.task("style", function () {
    gulp
      .src("./src/ozsavingspro/less/*.css")
      // .pipe(less())
      .pipe(
        autoprefixer(
          "last 2 version",
          "safari 5",
          "ie 8",
          "ie 9",
          "opera 12.1",
          "ios 6",
          "android 4"
        )
      )
      .on("error", function (e) {
        console.log(e)
      })
      .pipe(minifyCSS())
      .pipe(gulp.dest("./css/ozsavingspro/"))
  })
  gulp.task("watch", function () {
    gulp.watch("src/ozsavingspro/less/*.css", ["style"])
  })
  gulp.task("default", ["watch"])
}

function gulpForFr() {
  gulp.task('style', function () {
    return gulp.src('./src/noscodespromo/less/merchant.css')
      .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
      .on('error', function (e) {
        console.log(e)
      })
      .pipe(minifyCSS())
      .pipe(gulp.dest('./css/noscodespromo/'))
  })
  gulp.task('watch', function () {
    gulp.watch('src/noscodespromo/less/merchant.css', ['style'])
  })
  gulp.task('default', ['watch'])
}
/**
 * promocode aleve
 * hkcouponlife avail
 * indirimkod star
 * couponcode online
 * orangeoffer enlsls
 * kouponia left
 */
