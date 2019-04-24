const express = require('express')
const rp = require('request-promise-native')
const cheerio = require('cheerio')
const { DateTime } = require('luxon')

const server = express()

const SIGA_URLS = {
  LOGIN: 'https://siga.cps.sp.gov.br/aluno/login.aspx',
  HOME: 'https://siga.cps.sp.gov.br/aluno/home.aspx'
}

const cookieJar = rp.jar()

server.get('/', (req, res) => res.send('Working'))

server.get('/login', (req, res) => {
  rp({
    uri: SIGA_URLS['LOGIN'],
    method: 'GET',
    jar: cookieJar
  }).then(body => {
    const parsedGXState = JSON.parse(
      cheerio
        .load(body)('[name=GXState]')
        .val()
    )

    const GXState = {
      ...parsedGXState,
      _EventName: 'EENTER.',
      sCallerURL: SIGA_URLS['HOME']
    }

    const options = {
      uri: SIGA_URLS['LOGIN'],
      method: 'POST',
      form: {
        vSIS_USUARIOID: req.query.user,
        vSIS_USUARIOSENHA: Buffer.from(req.query.pass, 'base64').toString(),
        GXState: JSON.stringify(GXState)
      },
      jar: cookieJar,
      followAllRedirects: true
    }

    rp(options)
      .then(lbody => {
        res.send(lbody)
      })
      .catch(error => console.error(error))
  })
})

server.get('/me', (req, res) => {
  rp({
    uri: SIGA_URLS['HOME'],
    method: 'GET',
    jar: cookieJar
  }).then(body => {
    const page = cheerio.load(body)
    const GXState = JSON.parse(
      page('[name=GXState]')
        .val()
        .replace(/<(\b|\/)[^>]+>/g, '')
    )

    const userInfo = {
      avatar: page('#MPW0039FOTO')
        .children('img')
        .attr('src'),
      birthday: DateTime.fromFormat(
        page('#span_vPRO_PESSOALDATANASCIMENTO').text(),
        'dd/MM/yyyy'
      ).toUTC(),
      cpf: page('#span_vPRO_PESSOALDOCSCPF').text(),
      course: {
        name: GXState.vACD_CURSONOME_MPAGE,
        period: GXState.vACD_PERIODODESCRICAO_MPAGE,
        progress: GXState.MPW0039vACD_ALUNOCURSOINDICEPP
      },
      emails: {
        institucional: page('#span_vINSTITUCIONALFATEC').text(),
        pessoal: page('#span_vPRO_PESSOALEMAIL').text()
      },
      gradeAverage: GXState.MPW0039vACD_ALUNOCURSOINDICEPR.trim(),
      name: GXState.MPW0039vPRO_PESSOALNOME,
      ra: GXState.MPW0039vACD_ALUNOCURSOREGISTROACADEMICOCURSO,
      unit: GXState.vUNI_UNIDADENOME_MPAGE
    }

    res.send(userInfo)
  })
})

server.listen(8000, () => console.log('Server working on 8000'))
