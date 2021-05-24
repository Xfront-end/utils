/*
 * @Author: davis 
 * @Date: 2020-10-16 14:08:09 
 * @Last Modified by: davis
 * @Last Modified time: 2021-01-28 14:21:54
 */
const fs = require('fs')
const path = require('path')
const Client = require('ssh2-sftp-client')
const { stfp_config, REMOTE } = require('./setting')
const LOCAL_TPL_PATH = path.join(__dirname, '/tpl/')
const LOCAL_SRC_PATH = path.join(__dirname, '/src/')
const sftp = new Client()
const { log } = console

sftp
  .connect(stfp_config)
  .then(() => {
    log('☺ connect to remote service successed!')
  })
  .catch(err => {
    log(err, 'catch error')
  })

// promisify reader api
const readFilePromise = headerPath => {
  return new Promise((resolve, reject) => {
    fs.readFile(headerPath, 'utf-8', (err, data) => {
      if(err) {
        reject(err)
      }
      resolve(data)
    })
  })
}

//promisify writer api
const writeFilePromise = (headerPath, newContent, type) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(headerPath, newContent, err => {
      if(err) {
        reject(err)
      }
      resolve(`☺ update ${type} version successed! `)
    })
  })
}

/**
 * 
 * @param {*} site 域名
 * @param {*} type css or js
 */
const uploadToSFTP = (site, type) => {
  const TplPath = `/tpl/${site}/common_${type === 'js'?'footer':'header'}.html`
  const localTPL = path.join(__dirname, TplPath)
  const remoteTPL = `${REMOTE}${TplPath}`
  
  const fileName = `${type}/${srcPathFixer(site)}.${type}`
  const local = path.join(__dirname, `/${fileName}`)
  const remote = `${REMOTE}/${fileName}`

  Promise
    .all([
      sftp.put(local, remote), 
      sftp.put(localTPL, remoteTPL)
    ])
    .then(() => log('☺ sftp files upload successed'))
    .catch(err => log(err))
}

/**
 * 
 * @param {*} site 域名
 * @param {*} filePath 需要写入模板的地址
 * @param {*} regx 匹配js或css版本号的正则表达式 
 * @param {*} type css or js
 */
const update = (site, filePath, regx, type) => {
  readFilePromise(filePath)
  .then(Content => {
    const regResult = regx.exec(Content)
    if(!regResult) {
      throw new Error('该站点的引入js或css文件名与域名不一致')
    }
    const versionStr = regResult[0] ? regResult[0] : null
    if(versionStr) {
      let oldVerNumStr = versionStr.split('=')[1]
      if(oldVerNumStr.length > 16) {
        //防止版本号数值过大，丢失计算精度
        oldVerNumStr = oldVerNumStr.slice(0, 16)
      }
      const oldVerNum =  Number(oldVerNumStr)
      const newVerNum = `${srcPathFixer(site)}.${type}?${type === 'js'?'version':'v'}=${oldVerNum + 1}`
      const newContent = Content.replace(regx, newVerNum)
      writeFilePromise(filePath, newContent, type)
      .then(res => {
        log(res + `${newVerNum}`)
        uploadToSFTP(site, type)
      })
      .catch(err => {
        log(err)
      })
    }else {
      throw new Error(`can't find ${type} version string`)
    }
  })
  .catch(err => {
    throw new Error(`something wrong in updating ${type} version! \n error detail: ${err}`)
  })
}

//简单修复dist文件路径
const srcPathFixer = site => {
  const srcPath = path.join(__dirname, `src/${site}`)
  if(!fs.existsSync(srcPath)) {
    site = site.slice(0, site.indexOf('.'))
    if(!fs.existsSync(path.join(__dirname, `src/${site}`))) {
      throw new Error('该站点原文件名与域名不一致')
    }
  }
  return site
}

//获取某个站点src目录名称
const getReference = async site => {
  if(site === 'ozsavingspro.com' || site === 'noscodespromo.com') {
    return {}
  }
  let tplContent, cssReference, jsReference
  const regxCssReference = new RegExp('/css/[\\s\\S]*?.css', 'g')
  const regxJsReference = new RegExp('/js/[\\s\\S]*?.js', 'g')
  const siteHeaderTpl = path.join(LOCAL_TPL_PATH, `${site}/common_header.html`)
  const siteFooterTpl = path.join(LOCAL_TPL_PATH, `${site}/common_footer.html`)
  try {
    tplContent = await Promise.all([
      readFilePromise(siteHeaderTpl),
      readFilePromise(siteFooterTpl)
    ])
  }catch(err) {
    throw new Error(err)
  }
  const [ headerTpl, footerTpl ] = tplContent
  if(!(headerTpl && footerTpl)) {
    throw new Error('该站点对应模板内容为空')
  } 
  try {
    cssReferences = headerTpl.match(regxCssReference)
    cssReference = cssReferences.filter(item => item.indexOf(site.slice(0, site.indexOf('.'))) > -1)
    jsReferences = footerTpl.match(regxJsReference)
    jsReference = jsReferences.filter(item => item.indexOf(site.slice(0, site.indexOf('.'))) > -1)
  }catch(err) {
    throw new Error(`${site}匹配站点对应的源文件目录失败`, err)
  }
  return {
    site, 
    cssReference,
    jsReference
  }
}

//获取所有站点src目录名称
const getAllSrcRef = async () => {
  const localTpl = fs.readdirSync(LOCAL_TPL_PATH)
  let refs
  try {
    refs = await Promise.all(localTpl.map(site => getReference(site)))
  }catch(err) {
    throw new Error(err)
  }
  refs = refs.filter(ref => JSON.stringify(ref) != '{}')
  refs = refs.map(item => 
    item.cssReference[0].replace('/css/', '').replace('.css', '')
  )
  return refs
}


//递归删除文件
const deleteFolder = path => {
  let files = []
  if(fs.existsSync(path)) {
    files = fs.readdirSync(path)
    files.forEach(file => {
      let curPath = path + "/" + file
      if(fs.statSync(curPath).isDirectory()) {
        deleteFolder(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(path)
  }
}

//删除无用src文件
const removeUselessSrc = async () => {
  let refs
  try {
    refs = await getAllSrcRef()
    refs.push(...['ozsavingspro', 'noscodespromo'])
  }catch(err) {
    throw new Error(err)
  }
  let srcDir = fs.readdirSync(LOCAL_SRC_PATH)
  srcDir = srcDir.filter(item => item != '.svn')
  const result = srcDir.filter(dir => !refs.includes(dir))
  result.forEach(item => 
    deleteFolder(path.join(__dirname, `src/${item}`))
  )
}


/**
 * 更新common_header.html模板中引入的css版本号(版本号自增1)
 * @param {*} site 
 */
const updateCssVersion = async site => {
  const headerPath = path.join(__dirname, `tpl/${site}/common_header.html`)
  const regx = new RegExp(`${srcPathFixer(site)}.css\\?v=\\d+`)
  update(site, headerPath, regx, 'css')
}

/**
 * 更新common_footer.html模板中引入的js版本号(版本号自增1)
 * @param {*} site 
 */
//更新js版本号
const updateJsVersion = async site => {
  const footerPath = path.join(__dirname, `tpl/${site}/common_footer.html`)
  const regx = new RegExp(`${srcPathFixer(site)}.js\\?version=\\d+`)
  update(site, footerPath, regx, 'js')
}

/**
 * 修改映射站点的php文件并自动同步到测试环境ftp服务器
 * @param {*} site 域名
 * @param {*} mapFilePath 本地映射文件地址
 * @param {*} sftp ssh2-sftp-client 实例
 */
const syncMapFile = (site, mapFilePath, sftp)  => {
  const localMapFilePath = path.join(__dirname, mapFilePath)
  const remoteMapFilePath = `${REMOTE}${mapFilePath}`
  readFilePromise(localMapFilePath)
    .then(res => {
      const regxSite = /\/\/ 站点切换[\s\S]*?\$host = [\s\S]*?;/g
      const regxForSite = /'[\s\S]*?'/g
      if (!regxSite.test(res)) {
        throw new Error('匹配切换站点正则有误')
      }
      const originSite = res.match(regxSite) && res.match(regxSite)[0]
      if (!regxForSite.test(originSite)) {
        throw new Error('站点字符串匹配出错')
      }
      const lastModifySite = originSite.match(regxForSite) && originSite.match(regxForSite)[0]
      const newSite = originSite.replace(lastModifySite, `'${site.trim()}'`)
      writeFilePromise(localMapFilePath, res.replace(originSite, newSite))
        .then(() => {
          sftp
          .put(localMapFilePath, remoteMapFilePath)
          .then(() => log(`sync mapfile successfully: ${site}`))
        }).catch(err => log(err))
    })
    .catch(err => log('读取映射文件失败', err))
}

module.exports = {
  updateCssVersion,
  updateJsVersion,
  srcPathFixer,
  removeUselessSrc,
  syncMapFile
}
