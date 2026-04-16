import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { jsPDF } from 'jspdf'
import { useLocation, useNavigate } from 'react-router-dom'
import AppHeader from './components/AppHeader'
import AnalysisPage from './pages/AnalysisPage'
import EditorPage from './pages/EditorPage'
import HistoryPage from './pages/HistoryPage'

const HISTORY_KEY = 'resume_ai_history_v2'
const THEME_KEY = 'resume_ai_theme'

const MODAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: 'Resume and job description content are processed in-memory for analysis. History items are stored only in your browser localStorage and can be removed by clearing browser data.',
  },
  terms: {
    title: 'Terms of Service',
    body: 'This platform provides AI-assisted drafting and evaluation. Users are responsible for reviewing accuracy and compliance before professional use.',
  },
  ethics: {
    title: 'AI Ethics',
    body: 'AI output may contain inaccuracies. Human review is required, and final hiring decisions should not rely solely on automated suggestions.',
  },
  editorGuard: {
    title: 'Evaluation Required',
    body: 'Please add your resume and job description, then click Evaluate Intelligence before opening the Editor page.',
  },
  respectGuard: {
    title: 'Respect Policy Warning',
    body: 'Potentially disrespectful language was detected. Please remove inappropriate words before continuing.',
  },
}

const BAD_WORD_PATTERNS = [
  { label: 'f***', regex: /\bf+u+c+k+(?:ing|er|ed|s)?\b/i },
  { label: 's***', regex: /\bsh+i+t+(?:ty|ting|ted|s)?\b/i },
  { label: 'b****', regex: /\bb+i+t+c+h+(?:es|y)?\b/i },
  { label: 'a******', regex: /\bass\s*hole(?:s)?\b/i },
  { label: 'p***', regex: /\bputa\b/i },
  { label: 'p******', regex: /\bputang\s*ina\b/i },
]

function findDetectedBadWords(sourceText) {
  const text = String(sourceText || '').toLowerCase()
  if (!text.trim()) return []

  return BAD_WORD_PATTERNS.filter((item) => item.regex.test(text)).map((item) => item.label)
}

function createEmptyDraft() {
  return {
    profile: {
      fullName: 'YOUR NAME',
      title: '',
      email: '',
      phone: '',
      location: '',
      links: '',
    },
    summary: '',
    skills: [''],
    experience: [
      {
        company: '',
        jobTitle: '',
        startDate: '',
        endDate: '',
        isPresent: false,
        responsibilities: [''],
      },
    ],
    projects: [],
    education: [
      {
        school: '',
        degree: '',
        year: '',
      },
    ],
    references: [],
  }
}

function parseAtsToDraft(atsText) {
  const sourceText = typeof atsText === 'string' ? atsText : ''
  const lowered = sourceText.toLowerCase()
  const reportMarkers = [
    'precision alignment',
    'intelligence report',
    'strategic assets',
    'growth opportunities',
    'actionable refinements',
    'quantitative breakdown',
    'evaluation narrative',
  ]
  const hasReportShape = reportMarkers.some((marker) => lowered.includes(marker))

  const draft = createEmptyDraft()
  if (!sourceText.trim() || hasReportShape) return draft

  const text = sourceText.replace(/\r/g, '')
  const lines = text.split('\n').map((line) => line.trimEnd())

  const sectionAlias = {
    HEADER: 'header',
    SUMMARY: 'summary',
    'PROFESSIONAL SUMMARY': 'summary',
    'CORE COMPETENCIES': 'skills',
    SKILLS: 'skills',
    EXPERIENCE: 'experience',
    'PROFESSIONAL EXPERIENCE': 'experience',
    PROJECTS: 'projects',
    EDUCATION: 'education',
    REFERENCES: 'references',
    REFERENCE: 'references',
  }

  const sections = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    references: [],
  }

  let currentSection = 'header'
  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return

    const normalized = line.toUpperCase().replace(/:$/, '')
    if (sectionAlias[normalized]) {
      currentSection = sectionAlias[normalized]
      return
    }

    sections[currentSection].push(line)
  })

  const headerLines = sections.header.filter(Boolean)
  if (headerLines.length) {
    draft.profile.fullName = (headerLines[0] || 'YOUR NAME').replace(/^[-*]\s*/, '').toUpperCase()
    const contactBits = headerLines.slice(1).join(' | ').split('|').map((bit) => bit.trim()).filter(Boolean)
    if (contactBits.length) {
      const possibleEmail = contactBits.find((bit) => bit.includes('@'))
      if (possibleEmail) draft.profile.email = possibleEmail
      const possiblePhone = contactBits.find((bit) => /\d/.test(bit) && !bit.includes('@'))
      if (possiblePhone) draft.profile.phone = possiblePhone
      const remaining = contactBits.filter((bit) => bit !== possibleEmail && bit !== possiblePhone)
      if (remaining.length) draft.profile.location = remaining[0]
      if (remaining.length > 1) draft.profile.links = remaining.slice(1).join(' | ')
    }
  } else {
    const firstLine = lines.find((line) => line.trim() && line.trim().toUpperCase() !== 'HEADER')
    if (firstLine) draft.profile.fullName = firstLine.trim().toUpperCase()
  }

  if (sections.summary.length) {
    draft.summary = sections.summary.join(' ').replace(/\s+/g, ' ').trim()
  }

  if (sections.skills.length) {
    const skillItems = sections.skills
      .join('\n')
      .split(/\n|,|;|\|/)
      .map((s) => s.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    if (skillItems.length) draft.skills = skillItems
  }

  if (sections.experience.length) {
    const startsWithActionVerb = (line) =>
      /^(Developed|Implemented|Integrated|Designed|Built|Created|Led|Managed|Contributed|Improved|Optimized|Delivered|Collaborated|Supported|Published|Launched|Automated|Configured|Maintained|Engineered|Deployed|Fixed|Reduced|Increased|Spearheaded|Owned|Drove|Analyzed|Architected)\b/i.test(
        (line || '').trim(),
      )

    const extractDateRange = (rawText = '') => {
      const text = rawText.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      if (!text) {
        return {
          startDate: '',
          endDate: '',
          isPresent: false,
          cleanedText: rawText,
        }
      }

      const monthToken = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
      const point = `(?:${monthToken}\\s+)?(?:19|20)\\d{2}`
      const rangeRegex = new RegExp(`(${point})\\s*(?:-|–|—|to)\\s*(Present|Current|Now|${point})`, 'i')

      const match = text.match(rangeRegex)
      if (!match) {
        return {
          startDate: '',
          endDate: '',
          isPresent: false,
          cleanedText: rawText,
        }
      }

      const startDate = (match[1] || '').trim()
      const rightSide = (match[2] || '').trim()
      const isPresent = /present|current|now/i.test(rightSide)
      const endDate = isPresent ? '' : rightSide
      const matchedText = match[0]
      const cleanedText = rawText.replace(matchedText, '').replace(/[|,\-–—]\s*$/, '').trim()

      return {
        startDate,
        endDate,
        isPresent,
        cleanedText,
      }
    }

    const blocks = sections.experience
      .join('\n')
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)

    const parsedExperience = blocks.map((block) => {
      const blockLines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      const first = blockLines[0] || ''
      const second = blockLines[1] || ''

      const headerParts = first.includes('|')
        ? first.split('|').map((part) => part.trim()).filter(Boolean)
        : [first]

      let startDate = ''
      let endDate = ''
      let isPresent = false

      const datePartIndex = headerParts.findIndex((part) => Boolean(extractDateRange(part).startDate))
      if (datePartIndex >= 0) {
        const parsedDate = extractDateRange(headerParts[datePartIndex])
        startDate = parsedDate.startDate
        endDate = parsedDate.endDate
        isPresent = parsedDate.isPresent
        headerParts.splice(datePartIndex, 1)
      } else {
        const parsedDateInFirst = extractDateRange(first)
        if (parsedDateInFirst.startDate) {
          startDate = parsedDateInFirst.startDate
          endDate = parsedDateInFirst.endDate
          isPresent = parsedDateInFirst.isPresent
          if (!first.includes('|')) {
            headerParts[0] = parsedDateInFirst.cleanedText || headerParts[0]
          }
        }
      }

      const parsedDateInSecond = extractDateRange(second)
      if (!startDate && parsedDateInSecond.startDate) {
        startDate = parsedDateInSecond.startDate
        endDate = parsedDateInSecond.endDate
        isPresent = parsedDateInSecond.isPresent
      }

      const jobTitlePart = headerParts[0] || first
      let companyPart = headerParts[1] || ''
      let bodyStartIndex = 1

      const secondLooksMeta =
        Boolean(second) &&
        !startsWithActionVerb(second) &&
        !/^[-*]/.test(second) &&
        !parsedDateInSecond.startDate &&
        second.split(/\s+/).length <= 10

      if (!companyPart && secondLooksMeta) {
        companyPart = second
        bodyStartIndex = 2
      }

      const bulletLines = blockLines
        .slice(bodyStartIndex)
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)

      return {
        company: companyPart || '',
        jobTitle: jobTitlePart || first || '',
        startDate,
        endDate,
        isPresent,
        responsibilities: bulletLines.length ? bulletLines : [''],
      }
    })

    if (parsedExperience.length) draft.experience = parsedExperience
  }

  if (sections.projects.length) {
    const normalizedProjectLines = sections.projects
      .map((line) => line.trim())
      .filter(Boolean)

    const stripProjectPrefix = (line) =>
      line
        .replace(/^[-*|]+\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim()

    const startsWithActionVerb = (line) =>
      /^(Developed|Implemented|Integrated|Designed|Built|Created|Led|Managed|Contributed|Improved|Optimized|Delivered|Collaborated|Supported|Published|Launched|Automated|Configured|Maintained|Engineered|Deployed)\b/i.test(
        stripProjectPrefix(line),
      )

    const isProjectTitle = (line) => {
      const clean = stripProjectPrefix(line)
      if (!clean) return false
      if (/^technologies?:/i.test(clean)) return false
      if (clean.length > 86) return false
      if (/[.!?]$/.test(clean)) return false

      const wordCount = clean.split(/\s+/).filter(Boolean).length
      const looksLikeHeading = /^[A-Z0-9][A-Za-z0-9&/()+,'\-.\s\u2013\u2014]+$/.test(clean)
      const hasSeparator = /\s[-:\u2013\u2014|]\s/.test(clean)

      if (startsWithActionVerb(clean)) return false
      if (/,/.test(clean) && wordCount > 8) return false
      if (hasSeparator && wordCount <= 14 && looksLikeHeading) return true
      if (wordCount <= 8 && looksLikeHeading) return true
      return false
    }

    const parsedProjects = []
    let currentProject = null

    const pushCurrentProject = () => {
      if (!currentProject) return
      const normalizedName = (currentProject.name || '').trim()
      const normalizedDescription = currentProject.points.join('\n').trim()
      if (!normalizedName && !normalizedDescription && !currentProject.technologies.trim()) return
      parsedProjects.push({
        name: normalizedName || 'Project',
        description: normalizedDescription,
        technologies: currentProject.technologies.trim(),
      })
    }

    normalizedProjectLines.forEach((rawLine, index) => {
      const line = stripProjectPrefix(rawLine)
      if (!line) return

      if (/^technologies?:/i.test(line)) {
        if (!currentProject) {
          currentProject = { name: 'Project', points: [], technologies: '' }
        }
        const techValue = line.replace(/^technologies?:\s*/i, '').trim()
        currentProject.technologies = techValue
        return
      }

      if (!currentProject) {
        currentProject = { name: line, points: [], technologies: '' }
        return
      }

      if (startsWithActionVerb(line)) {
        currentProject.points.push(line)
        return
      }

      if (isProjectTitle(line) && (currentProject.points.length > 0 || currentProject.technologies)) {
        pushCurrentProject()
        currentProject = { name: line, points: [], technologies: '' }
        return
      }

      if (index === 1 && !currentProject.points.length && !isProjectTitle(line)) {
        currentProject.points.push(line)
        return
      }

      currentProject.points.push(line)
    })

    pushCurrentProject()

    const repairedProjects = []
    parsedProjects.forEach((project) => {
      if (!repairedProjects.length) {
        repairedProjects.push(project)
        return
      }

      const onlyTitle = !project.description && !project.technologies
      if (onlyTitle && startsWithActionVerb(project.name)) {
        const previous = repairedProjects[repairedProjects.length - 1]
        previous.description = previous.description
          ? `${previous.description}\n${project.name}`
          : project.name
        return
      }

      repairedProjects.push(project)
    })

    if (repairedProjects.length) draft.projects = repairedProjects
  }

  if (sections.education.length) {
    const eduLines = sections.education.map((l) => l.trim()).filter(Boolean)
    if (eduLines.length) {
      draft.education = eduLines.map((line) => {
        const clean = line.replace(/^[-*]\s*/, '').trim()
        const yearMatch = clean.match(/\b(19|20)\d{2}(\s*-\s*(Present|(19|20)\d{2}))?\b/i)
        const year = yearMatch ? yearMatch[0] : ''
        const withoutYear = year ? clean.replace(year, '').replace(/[|,\-]\s*$/, '').trim() : clean

        let school = ''
        let degree = ''

        if (withoutYear.includes('|')) {
          const [left, right] = withoutYear.split('|').map((part) => part.trim())
          if (/university|college|institute|school/i.test(left)) {
            school = left
            degree = right || ''
          } else {
            degree = left
            school = right || ''
          }
        } else if (withoutYear.includes(',')) {
          const [first, ...rest] = withoutYear.split(',').map((part) => part.trim()).filter(Boolean)
          const second = rest.join(', ')
          if (/university|college|institute|school/i.test(first)) {
            school = first
            degree = second
          } else {
            degree = first
            school = second
          }
        } else {
          school = withoutYear
        }

        return {
          school,
          degree,
          year,
        }
      })
    }
  }

  if (sections.references.length) {
    const referenceItems = sections.references
      .map((line) => line.replace(/^[-*|]+\s*/, '').trim())
      .filter(Boolean)
    if (referenceItems.length) draft.references = referenceItems
  }

  return draft
}

function draftToPlainText(draft) {
  const lines = []
  lines.push(draft.profile.fullName || '')
  if (draft.profile.title) lines.push(draft.profile.title)
  const contactLine = [draft.profile.email, draft.profile.phone, draft.profile.location, draft.profile.links]
    .filter(Boolean)
    .join(' | ')
  if (contactLine) lines.push(contactLine)
  lines.push('')

  lines.push('PROFESSIONAL SUMMARY')
  lines.push(draft.summary || '')
  lines.push('')

  lines.push('CORE COMPETENCIES')
  draft.skills.filter(Boolean).forEach((s) => lines.push(`- ${s}`))
  lines.push('')

  lines.push('PROFESSIONAL EXPERIENCE')
  draft.experience.forEach((exp) => {
    const dateLabel = exp.isPresent
      ? `${exp.startDate || ''} - Present`
      : `${exp.startDate || ''} - ${exp.endDate || ''}`
    lines.push(`${exp.jobTitle || ''} | ${exp.company || ''} ${dateLabel}`.trim())
    exp.responsibilities.filter(Boolean).forEach((r) => lines.push(`- ${r}`))
    lines.push('')
  })

  if (draft.projects.length) {
    lines.push('PROJECTS')
    draft.projects.forEach((p) => {
      lines.push(`${p.name || ''}`)
      if (p.description) lines.push(`- ${p.description}`)
      if (p.technologies) lines.push(`Tech: ${p.technologies}`)
      lines.push('')
    })
  }

  lines.push('EDUCATION')
  draft.education.forEach((e) => {
    lines.push(`${e.degree || ''} ${e.school || ''} ${e.year || ''}`.trim())
  })

  if (draft.references?.filter(Boolean).length) {
    lines.push('')
    lines.push('REFERENCES')
    draft.references.filter(Boolean).forEach((refItem) => lines.push(`- ${refItem}`))
  }

  return lines.join('\n').trim()
}

function drawSectionHeader(doc, yRef, marginX, width, title, ensureSpace) {
  ensureSpace(26)
  doc.setFont('times', 'bold')
  doc.setFontSize(10.2)
  doc.setTextColor(35, 35, 35)
  doc.text(title.toUpperCase(), marginX, yRef.value)
  yRef.value += 6
  doc.setLineWidth(0.5)
  doc.setDrawColor(55, 55, 55)
  doc.line(marginX, yRef.value, marginX + width, yRef.value)
  yRef.value += 10
}

function drawWrappedLines(doc, yRef, marginX, width, text, lineHeight, ensureSpace) {
  const wrapped = doc.splitTextToSize(text, width)
  wrapped.forEach((line) => {
    ensureSpace(lineHeight)
    doc.text(line, marginX, yRef.value)
    yRef.value += lineHeight
  })
}

function buildHarvardResumePdfFromDraft(draft) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
  const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2
  const yRef = { value: 54 }

  const ensureSpace = (needed = 16) => {
    if (yRef.value + needed <= pageHeight - 46) return
    doc.addPage()
    yRef.value = 54
  }

  const pageFooter = () => {
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i)
      doc.setFont('times', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      doc.text(String(i), marginX + contentWidth, pageHeight - 24, { align: 'right' })
    }
  }

  doc.setFont('times', 'bold')
  doc.setTextColor(12, 12, 12)
  const headerName = (draft.profile.fullName || 'YOUR NAME').toUpperCase()
  let headerFontSize = 20
  doc.setFontSize(headerFontSize)
  while (doc.getTextWidth(headerName) > contentWidth && headerFontSize > 14) {
    headerFontSize -= 1
    doc.setFontSize(headerFontSize)
  }
  doc.text(headerName, marginX + contentWidth / 2, yRef.value, { align: 'center' })
  yRef.value += 16

  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  const contactLine = [
    draft.profile.title,
    draft.profile.email,
    draft.profile.phone,
    draft.profile.location,
    draft.profile.links,
  ]
    .filter(Boolean)
    .join(' | ')
  if (contactLine) {
    doc.text(contactLine, marginX + contentWidth / 2, yRef.value, { align: 'center' })
    yRef.value += 13
  }

  doc.setLineWidth(0.7)
  doc.setDrawColor(35, 35, 35)
  doc.line(marginX, yRef.value, marginX + contentWidth, yRef.value)
  yRef.value += 12

  drawSectionHeader(doc, yRef, marginX, contentWidth, 'Professional Summary', ensureSpace)
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  drawWrappedLines(doc, yRef, marginX, contentWidth, draft.summary || '[ADD TARGETED PROFESSIONAL SUMMARY]', 13, ensureSpace)
  yRef.value += 6

  drawSectionHeader(doc, yRef, marginX, contentWidth, 'Core Competencies', ensureSpace)
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  const skills = draft.skills.filter(Boolean)
  if (skills.length) {
    const leftColumn = skills.filter((_, idx) => idx % 2 === 0)
    const rightColumn = skills.filter((_, idx) => idx % 2 !== 0)
    const colGap = 18
    const colWidth = (contentWidth - colGap) / 2
    const maxRows = Math.max(leftColumn.length, rightColumn.length)
    for (let i = 0; i < maxRows; i += 1) {
      ensureSpace(13)
      if (leftColumn[i]) doc.text(`- ${leftColumn[i]}`, marginX, yRef.value)
      if (rightColumn[i]) doc.text(`- ${rightColumn[i]}`, marginX + colWidth + colGap, yRef.value)
      yRef.value += 13
    }
  } else {
    drawWrappedLines(doc, yRef, marginX, contentWidth, '- [ADD RELEVANT COMPETENCIES]', 13, ensureSpace)
  }
  yRef.value += 6

  drawSectionHeader(doc, yRef, marginX, contentWidth, 'Professional Experience', ensureSpace)
  draft.experience.forEach((exp) => {
    ensureSpace(24)
    doc.setFont('times', 'bold')
    doc.setFontSize(10.8)
    const titleText = `${exp.jobTitle || 'Role'}${exp.company ? ` | ${exp.company}` : ''}`

    const dateText = exp.isPresent
      ? `${exp.startDate || ''} - Present`
      : `${exp.startDate || ''} - ${exp.endDate || ''}`
    doc.setFont('times', 'italic')
    doc.setFontSize(10.2)
    const hasDate = dateText.trim() && dateText.trim() !== '-'
    const dateWidth = hasDate ? doc.getTextWidth(dateText) : 0
    const titleMaxWidth = hasDate ? Math.max(120, contentWidth - dateWidth - 16) : contentWidth

    doc.setFont('times', 'bold')
    doc.setFontSize(10.8)
    const titleLines = doc.splitTextToSize(titleText, titleMaxWidth)
    ensureSpace(13 * titleLines.length + 2)
    doc.text(titleLines, marginX, yRef.value)

    if (hasDate) {
      doc.setFont('times', 'italic')
      doc.setFontSize(10.2)
      doc.text(dateText, marginX + contentWidth - dateWidth, yRef.value)
    }
    yRef.value += 13

    doc.setFont('times', 'normal')
    doc.setFontSize(10.2)
    const bullets = exp.responsibilities.filter(Boolean)
    ;(bullets.length ? bullets : ['[ADD IMPACT BULLETS]']).forEach((resp) => {
      drawWrappedLines(doc, yRef, marginX + 8, contentWidth - 8, `- ${resp}`, 12.5, ensureSpace)
    })
    yRef.value += 4
  })

  if (draft.projects.length) {
    drawSectionHeader(doc, yRef, marginX, contentWidth, 'Projects', ensureSpace)
    draft.projects.forEach((project) => {
      ensureSpace(20)
      doc.setFont('times', 'bold')
      doc.setFontSize(10.8)
      doc.text(project.name || 'Project Name', marginX, yRef.value)
      yRef.value += 12

      doc.setFont('times', 'normal')
      doc.setFontSize(10.2)
      const projectBullets = (project.description || '')
        .split(/\n+/)
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
      if (projectBullets.length) {
        projectBullets.forEach((bullet) => {
          drawWrappedLines(doc, yRef, marginX + 8, contentWidth - 8, `- ${bullet}`, 12.5, ensureSpace)
        })
      }
      if (project.technologies) {
        drawWrappedLines(doc, yRef, marginX + 8, contentWidth - 8, `Technologies: ${project.technologies}`, 12.5, ensureSpace)
      }
      yRef.value += 4
    })
  }

  drawSectionHeader(doc, yRef, marginX, contentWidth, 'Education', ensureSpace)
  draft.education.forEach((edu) => {
    ensureSpace(17)
    doc.setFont('times', 'bold')
    doc.setFontSize(10.8)
    const left = [edu.degree, edu.school].filter(Boolean).join(' | ') || 'Education'

    doc.setFont('times', 'italic')
    doc.setFontSize(10.2)
    const year = edu.year || ''
    const yearWidth = year ? doc.getTextWidth(year) : 0
    const textWidth = year ? Math.max(120, contentWidth - yearWidth - 16) : contentWidth

    doc.setFont('times', 'bold')
    doc.setFontSize(10.8)
    const eduLines = doc.splitTextToSize(left, textWidth)
    ensureSpace(13 * eduLines.length + 2)
    doc.text(eduLines, marginX, yRef.value)
    if (year) doc.text(year, marginX + contentWidth - yearWidth, yRef.value)
    yRef.value += 13 * eduLines.length
  })

  if (draft.references?.filter(Boolean).length) {
    drawSectionHeader(doc, yRef, marginX, contentWidth, 'References', ensureSpace)
    doc.setFont('times', 'normal')
    doc.setFontSize(10.2)
    draft.references.filter(Boolean).forEach((refItem) => {
      drawWrappedLines(doc, yRef, marginX, contentWidth, refItem, 12.5, ensureSpace)
    })
    yRef.value += 4
  }

  pageFooter()

  return doc
}

async function exportPreviewElementToPdf(element, fileName) {
  if (!element) throw new Error('Preview element is not available.')

  const html2pdfModule = await import('html2pdf.js')
  const html2pdf = html2pdfModule.default

  const previousInlineStyle = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    margin: element.style.margin,
    boxShadow: element.style.boxShadow,
    borderRadius: element.style.borderRadius,
    border: element.style.border,
    paddingTop: element.style.paddingTop,
    paddingRight: element.style.paddingRight,
    paddingBottom: element.style.paddingBottom,
    paddingLeft: element.style.paddingLeft,
  }

  element.style.width = '740px'
  element.style.maxWidth = '740px'
  element.style.margin = '0'
  element.style.boxShadow = 'none'
  element.style.borderRadius = '0'
  element.style.border = 'none'
  element.style.paddingTop = '54px'
  element.style.paddingBottom = '54px'
  element.style.paddingLeft = '54px'
  element.style.paddingRight = '84px'

  const opt = {
    margin: [32, 32, 32, 60],
    filename: fileName,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      avoid: ['.harvard-header', '.preview-section', '.preview-entry', '.preview-entry-head']
    },
  }

  try {
    await html2pdf().set(opt).from(element).save()
  } finally {
    element.style.width = previousInlineStyle.width
    element.style.maxWidth = previousInlineStyle.maxWidth
    element.style.margin = previousInlineStyle.margin
    element.style.boxShadow = previousInlineStyle.boxShadow
    element.style.borderRadius = previousInlineStyle.borderRadius
    element.style.border = previousInlineStyle.border
    element.style.paddingTop = previousInlineStyle.paddingTop
    element.style.paddingRight = previousInlineStyle.paddingRight
    element.style.paddingBottom = previousInlineStyle.paddingBottom
    element.style.paddingLeft = previousInlineStyle.paddingLeft
  }
}

function App() {
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refining, setRefining] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [theme, setTheme] = useState('dark')
  const [activeModal, setActiveModal] = useState(null)
  const [draft, setDraft] = useState(createEmptyDraft)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('')
  const previewRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const currentView =
    location.pathname === '/editor'
      ? 'editor'
      : location.pathname === '/history'
        ? 'history'
        : 'analysis'

  const api = useMemo(
    () =>
      axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
        timeout: 30000,
      }),
    [],
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistoryItems(JSON.parse(stored))
    } catch {
      setHistoryItems([])
    }

    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const supportedPaths = ['/', '/editor', '/history']
    if (!supportedPaths.includes(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    if (location.pathname === '/editor' && !result) {
      setActiveModal('editorGuard')
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate, result])

  useEffect(() => {
    const doc = buildHarvardResumePdfFromDraft(draft)
    const url = URL.createObjectURL(doc.output('blob'))
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [draft])

  const saveHistory = (entry) => {
    const updated = [entry, ...historyItems].slice(0, 50)
    setHistoryItems(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const updateDraftField = (section, key, value) => {
    setDraft((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }))
  }

  const addListItem = (section, emptyValue) => {
    setDraft((prev) => ({ ...prev, [section]: [...prev[section], emptyValue] }))
  }

  const updateListItem = (section, index, value) => {
    setDraft((prev) => ({
      ...prev,
      [section]: prev[section].map((item, idx) => (idx === index ? value : item)),
    }))
  }

  const removeListItem = (section, index) => {
    setDraft((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, idx) => idx !== index),
    }))
  }

  const updateExperienceField = (index, key, value) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, idx) => (idx === index ? { ...exp, [key]: value } : exp)),
    }))
  }

  const updateExperienceBullet = (expIndex, bulletIndex, value) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, idx) =>
        idx === expIndex
          ? {
              ...exp,
              responsibilities: exp.responsibilities.map((b, bIdx) => (bIdx === bulletIndex ? value : b)),
            }
          : exp,
      ),
    }))
  }

  const addExperienceBullet = (expIndex) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, idx) =>
        idx === expIndex ? { ...exp, responsibilities: [...exp.responsibilities, ''] } : exp,
      ),
    }))
  }

  const removeExperienceBullet = (expIndex, bulletIndex) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, idx) =>
        idx === expIndex
          ? {
              ...exp,
              responsibilities: exp.responsibilities.filter((_, bIdx) => bIdx !== bulletIndex),
            }
          : exp,
      ),
    }))
  }

  const showRespectWarning = () => {
    setActiveModal('respectGuard')
  }

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const filename = file.name.toLowerCase()
    const isPdf = filename.endsWith('.pdf')
    const isDocx = filename.endsWith('.docx')

    if (!isPdf && !isDocx) {
      setError('Please upload a PDF or DOCX resume file.')
      return
    }

    setError('')
    setExtracting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/extract-resume-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const extractedText = response.data.resume_text || ''
      const detectedWords = findDetectedBadWords(extractedText)
      if (detectedWords.length) {
        setResumeText('')
        showRespectWarning()
        return
      }

      setResumeText(extractedText)
    } catch (uploadError) {
      setError(uploadError.response?.data?.detail || 'Unable to extract resume text from file.')
    } finally {
      setExtracting(false)
      event.target.value = ''
    }
  }

  const handleEvaluate = async () => {
    setError('')
    setResult(null)
    setCopyStatus('')

    const resumeDetectedWords = findDetectedBadWords(resumeText)
    if (resumeDetectedWords.length) {
      showRespectWarning()
      return
    }

    const jobDetectedWords = findDetectedBadWords(jobDescription)
    if (jobDetectedWords.length) {
      showRespectWarning()
      return
    }

    if (resumeText.trim().length < 50) {
      setError('Resume text must be at least 50 characters.')
      return
    }

    if (jobDescription.trim().length < 50) {
      setError('Job description must be at least 50 characters.')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/evaluate', {
        resume_text: resumeText,
        job_description: jobDescription,
      })
      setResult(response.data)
      let atsSource = response.data?.ats_resume || ''
      const atsLower = String(atsSource || '').toLowerCase()
      const isReportLikeAts = [
        'precision alignment',
        'intelligence report',
        'strategic assets',
        'growth opportunities',
        'actionable refinements',
        'quantitative breakdown',
      ].some((marker) => atsLower.includes(marker))

      if (!atsSource || !String(atsSource).trim() || isReportLikeAts) {
        const missingKeywords = Array.isArray(response.data?.missing_keywords)
          ? response.data.missing_keywords.filter(Boolean).slice(0, 8).join(', ')
          : '[ADD JD KEYWORDS]'

        atsSource = [
          'HEADER',
          (resumeText || '').split(/\r?\n/).find((line) => line.trim()) || 'YOUR NAME',
          '',
          'PROFESSIONAL SUMMARY',
          'Tailor this profile to the target role by integrating missing keywords and measurable outcomes from existing experience.',
          '',
          'CORE COMPETENCIES',
          `- Target role keywords to integrate: ${missingKeywords}`,
          '',
          'PROFESSIONAL EXPERIENCE',
          ...((resumeText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(1, 7)
            .map((line) => `- ${line}`)),
          '',
          'EDUCATION',
          '- [ADD EDUCATION DETAILS FROM RESUME]',
        ].join('\n')
      }

      const nextDraft = parseAtsToDraft(atsSource)
      setDraft(nextDraft)
      navigate('/')

      saveHistory({
        id: Date.now(),
        createdAt: new Date().toISOString(),
        score: response.data.match_score,
        verdict: response.data.match_verdict,
        isQualified: response.data.is_qualified,
        resumeText,
        jobDescription,
        result: response.data,
        draft: nextDraft,
      })
    } catch (evaluationError) {
      setError(evaluationError.response?.data?.detail || 'Evaluation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleTryAnother = () => {
    setResult(null)
    setCopyStatus('')
    navigate('/')
  }

  const handleDownload = async () => {
    setExportingPdf(true)
    try {
      if (previewRef.current) {
        await exportPreviewElementToPdf(previewRef.current, 'Gamayo_JohnCarlo_Harvard_Resume.pdf')
      } else {
        const doc = buildHarvardResumePdfFromDraft(draft)
        doc.save('Gamayo_JohnCarlo_Harvard_Resume.pdf')
      }
    } finally {
      setExportingPdf(false)
    }
  }

  const handleDownloadTxt = () => {
    const plainText = draftToPlainText(draft)
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'Gamayo_JohnCarlo_ATS_Resume.txt'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const handleRefineWithAi = async () => {
    if (!result) {
      setError('Run evaluation first before refining with AI.')
      return
    }

    if (jobDescription.trim().length < 50) {
      setError('Job description must be at least 50 characters.')
      return
    }

    setError('')
    setCopyStatus('')
    setRefining(true)

    try {
      const response = await api.post('/refine-resume', {
        current_resume_text: draftToPlainText(draft),
        job_description: jobDescription,
        suggestions: Array.isArray(result?.suggestions) ? result.suggestions : [],
        skill_gaps: Array.isArray(result?.skill_gaps) ? result.skill_gaps : [],
        missing_keywords: Array.isArray(result?.missing_keywords) ? result.missing_keywords : [],
        phrasing_improvements: Array.isArray(result?.phrasing_improvements) ? result.phrasing_improvements : [],
      })

      const refinedText = response.data?.ats_resume || ''
      const nextDraft = parseAtsToDraft(refinedText)
      setDraft(nextDraft)
      setCopyStatus('Refined with AI')
      navigate('/editor')

      setHistoryItems((prev) => {
        if (!prev.length) return prev
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          draft: nextDraft,
          refinedAt: new Date().toISOString(),
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
        return updated
      })
    } catch (refineError) {
      setError(refineError.response?.data?.detail || 'AI refinement failed. Please try again.')
    } finally {
      setRefining(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftToPlainText(draft))
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  const handleLoadHistory = (item) => {
    setResumeText(item.resumeText || '')
    setJobDescription(item.jobDescription || '')
    setResult(item.result || null)
    setDraft(item.draft || parseAtsToDraft(item.result?.ats_resume || ''))
    navigate('/')
  }

  const handleDeleteHistory = (id) => {
    setHistoryItems((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const handleNavigate = (view) => {
    if (view === 'analysis') {
      navigate('/')
      return
    }

    if (view === 'history') {
      navigate('/history')
      return
    }

    if (!result) {
      setActiveModal('editorGuard')
      return
    }

    navigate('/editor')
  }

  const score = Math.max(0, Math.min(100, Number(result?.match_score || 0)))
  const circumference = 2 * Math.PI * 52
  const dashOffset = circumference - (score / 100) * circumference
  const defaultBreakdown = [
    { category: 'Skills Match', score, weight: 0.25, reasoning: 'Detailed evidence not returned by provider for this category.' },
    { category: 'Experience Match', score, weight: 0.25, reasoning: 'Detailed evidence not returned by provider for this category.' },
    { category: 'Tooling/Tech Stack Match', score, weight: 0.25, reasoning: 'Detailed evidence not returned by provider for this category.' },
    { category: 'Domain/AI Relevance', score, weight: 0.25, reasoning: 'Detailed evidence not returned by provider for this category.' },
  ]
  const breakdown = Array.isArray(result?.score_breakdown) && result.score_breakdown.length
    ? result.score_breakdown
    : defaultBreakdown

  const executiveSummary = (result?.executive_summary || '').trim() || 'Summary data is not yet available from the current evaluator response. Re-run analysis after backend restart to generate a full narrative.'
  const normalizedScoring = (result?.normalized_scoring || '').trim() || `Weighted score = (${score} x 0.25) + (${score} x 0.25) + (${score} x 0.25) + (${score} x 0.25) = ${score}`

  const normalizeItems = (items, fallback) => {
    if (Array.isArray(items) && items.length) {
      return items
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    }
    return fallback
  }

  const criticalGaps = normalizeItems(result?.critical_gaps, normalizeItems(result?.skill_gaps, ['No critical gaps identified from current response.']))
  const moderateGaps = normalizeItems(result?.moderate_gaps, ['No moderate gaps identified from current response.'])
  const optionalGaps = normalizeItems(result?.optional_gaps, ['No optional gaps identified from current response.'])
  const missingKeywords = normalizeItems(result?.missing_keywords, ['No missing keyword data returned.'])
  const phrasingImprovements = normalizeItems(result?.phrasing_improvements, normalizeItems(result?.suggestions, ['No phrasing improvements returned.']))

  const headerProps = { currentView, onNavigate: handleNavigate, theme, setTheme }
  const analysisComponents = { ResultCard, HarvardResumePreview, PageFooter, PolicyModal }
  const editorComponents = { SectionCard, StringListEditor, HarvardResumePreview, PageFooter, PolicyModal }
  const historyComponents = { PageFooter, PolicyModal }

  if (loading) {
    return (
      <main className="screen processing-screen">
        <AppHeader {...headerProps} />
        <div className="bg-glow" />
        <section className="processing-wrap">
          <div className="processing-copy">
            <p className="eyebrow">System Processing</p>
            <h1 className="display serif">Synthesizing Your Professional DNA</h1>
            <p className="lead">Analyzing ATS fitness and role alignment...</p>
            <ul className="processing-steps">
              <li className="active">Parsing resume architecture</li>
              <li>Matching job requirements</li>
              <li>Composing optimized draft</li>
            </ul>
          </div>
          <aside className="processing-card">
            <div className="skeleton-row skeleton-hero" />
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </aside>
        </section>
      </main>
    )
  }

  if (currentView === 'editor' && result) {
    return (
      <EditorPage
        headerProps={headerProps}
        draft={draft}
        setDraft={setDraft}
        addListItem={addListItem}
        updateListItem={updateListItem}
        removeListItem={removeListItem}
        updateExperienceField={updateExperienceField}
        updateExperienceBullet={updateExperienceBullet}
        addExperienceBullet={addExperienceBullet}
        removeExperienceBullet={removeExperienceBullet}
        handleCopy={handleCopy}
        handleRefineWithAi={handleRefineWithAi}
        handleDownloadTxt={handleDownloadTxt}
        handleDownload={handleDownload}
        refining={refining}
        exportingPdf={exportingPdf}
        copyStatus={copyStatus}
        previewRef={previewRef}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        components={editorComponents}
      />
    )
  }

  if (currentView === 'history') {
    return (
      <HistoryPage
        headerProps={headerProps}
        historyItems={historyItems}
        handleLoadHistory={handleLoadHistory}
        handleDeleteHistory={handleDeleteHistory}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        components={historyComponents}
      />
    )
  }

  if (!result) {
    return (
      <main className="screen landing-screen">
        <AppHeader {...headerProps} />
        <div className="bg-glow" />
        <section className="hero">
          <h1 className="serif display lavender">The Resume Intelligence Engine</h1>
          <p className="lead">Quantify your professional value against any role in seconds.</p>
        </section>

        <section className="input-grid">
          <article className="dark-card">
            <div className="card-head"><p>Your Resume</p><span className="mini-icon">[]</span></div>
            <label className="drop-zone">
              <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handlePdfUpload} className="sr-only" />
              <span className="upload-icon">up</span>
              <p>Drag and drop PDF or DOCX</p>
              <small>or click to browse files</small>
            </label>
            <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Or paste raw text" rows={4} className="ghost-input" />
          </article>

          <article className="dark-card">
            <div className="card-head"><p>Target Role</p><span className="mini-icon">o</span></div>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description or role requirements here..." rows={11} className="ghost-input tall" />
          </article>
        </section>

        <div className="cta-wrap"><button type="button" disabled={extracting} onClick={handleEvaluate} className="violet-btn">Evaluate Intelligence</button></div>
        {extracting && <p className="status">Extracting resume text...</p>}
        {error && <p className="error-pill">{error}</p>}

        <PageFooter onModalOpen={setActiveModal} />
        {activeModal && <PolicyModal type={activeModal} onClose={() => setActiveModal(null)} />}
      </main>
    )
  }

  return (
    <AnalysisPage
      headerProps={headerProps}
      score={score}
      circumference={circumference}
      dashOffset={dashOffset}
      result={result}
      executiveSummary={executiveSummary}
      breakdown={breakdown}
      normalizedScoring={normalizedScoring}
      criticalGaps={criticalGaps}
      moderateGaps={moderateGaps}
      optionalGaps={optionalGaps}
      missingKeywords={missingKeywords}
      phrasingImprovements={phrasingImprovements}
      draft={draft}
      previewRef={previewRef}
      refining={refining}
      exportingPdf={exportingPdf}
      handleCopy={handleCopy}
      handleRefineWithAi={handleRefineWithAi}
      handleDownloadTxt={handleDownloadTxt}
      handleDownload={handleDownload}
      handleTryAnother={handleTryAnother}
      activeModal={activeModal}
      setActiveModal={setActiveModal}
      components={analysisComponents}
    />
  )
}

function SectionCard({ title, children }) {
  return (
    <section className="form-section-card">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function StringListEditor({ label, items, onAdd, onChange, onRemove, placeholder }) {
  return (
    <div className="string-list-editor">
      {label ? <p className="list-label">{label}</p> : null}
      {items.map((item, idx) => (
        <div className="list-row" key={`list-${idx}`}>
          <input className="ghost-input" value={item} onChange={(e) => onChange(idx, e.target.value)} placeholder={placeholder} />
          <button type="button" className="remove-btn" onClick={() => onRemove(idx)}>Remove</button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={onAdd}>Add Item</button>
    </div>
  )
}

function HarvardResumePreview({ draft, previewRef }) {
  const headerNameRaw = (draft.profile.fullName || 'YOUR NAME').trim()
  const headerName = headerNameRaw ? headerNameRaw.toUpperCase() : 'YOUR NAME'
  const headerNameClass =
    headerName.length >= 34 ? 'name-xl' : headerName.length >= 26 ? 'name-lg' : ''

  return (
    <article className="harvard-preview" ref={previewRef}>
      <header className="harvard-header">
        <h3 className={headerNameClass}>{headerName}</h3>
        <p>{[draft.profile.title, draft.profile.email, draft.profile.phone, draft.profile.location, draft.profile.links].filter(Boolean).join(' | ')}</p>
      </header>

      <PreviewSection title="Professional Summary">
        <p>{draft.summary}</p>
      </PreviewSection>

      <PreviewSection title="Core Competencies">
        <ul className="skills-list">
          {draft.skills.filter(Boolean).map((skill, idx) => <li key={`skill-${idx}`}>{skill}</li>)}
        </ul>
      </PreviewSection>

      <PreviewSection title="Professional Experience">
        {draft.experience.map((exp, idx) => (
          <div key={`exp-prev-${idx}`} className="preview-entry">
            <div className="preview-entry-head">
              <strong>{exp.jobTitle} {exp.company ? `| ${exp.company}` : ''}</strong>
              {(exp.startDate || exp.endDate || exp.isPresent) ? (
                <span>{exp.isPresent ? `${exp.startDate || ''} - Present` : `${exp.startDate || ''} - ${exp.endDate || ''}`}</span>
              ) : null}
            </div>
            <ul>
              {exp.responsibilities.filter(Boolean).map((r, rIdx) => <li key={`resp-${idx}-${rIdx}`}>{r}</li>)}
            </ul>
          </div>
        ))}
      </PreviewSection>

      {draft.projects.length ? (
        <PreviewSection title="Projects">
          {draft.projects.map((project, idx) => (
            <div key={`proj-prev-${idx}`} className="preview-entry preview-entry-project">
              <div className="preview-entry-head">
                <strong>{project.name}</strong>
              </div>
              {(project.description || '').trim() ? (
                <ul>
                  {(project.description || '')
                    .split(/\n+|\s*;\s*/)
                    .map((line) => line.replace(/^[-*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, lineIdx) => <li key={`proj-bullet-${idx}-${lineIdx}`}>{line}</li>)}
                </ul>
              ) : null}
              {project.technologies ? <p><em>Technologies:</em> {project.technologies}</p> : null}
            </div>
          ))}
        </PreviewSection>
      ) : null}

      <PreviewSection title="Education">
        {draft.education.map((edu, idx) => (
          <div key={`edu-prev-${idx}`} className="preview-entry preview-entry-education">
            <div className="preview-entry-head">
              <strong>{[edu.degree, edu.school].filter(Boolean).join(' | ') || 'Education'}</strong>
              {edu.year ? <span>{edu.year}</span> : null}
            </div>
          </div>
        ))}
      </PreviewSection>

      {draft.references?.filter(Boolean).length ? (
        <PreviewSection title="References">
          {draft.references.filter(Boolean).map((refItem, idx) => (
            <div key={`ref-${idx}`} className="preview-entry preview-entry-reference">
              <p>{refItem}</p>
            </div>
          ))}
        </PreviewSection>
      ) : null}
    </article>
  )
}

function PreviewSection({ title, children }) {
  return (
    <section className="preview-section">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function ResultCard({ title, items, tone }) {
  const toneClass = tone === 'success' ? 'tone-success' : tone === 'warning' ? 'tone-warning' : 'tone-info'
  return (
    <article className={`insight-card ${toneClass}`}>
      <h5 className="serif">{title}</h5>
      <ul>
        {items?.map((item, index) => (
          <li key={`${title}-${index}`}>
            <span aria-hidden="true" className="bullet">*</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function PageFooter({ onModalOpen }) {
  return (
    <footer className="site-footer">
      <p>(c) 2026 Developed by John Carlo Gamayo.</p>
      <nav>
        <button type="button" onClick={() => onModalOpen('privacy')}>Privacy Policy</button>
        <button type="button" onClick={() => onModalOpen('terms')}>Terms of Service</button>
        <button type="button" onClick={() => onModalOpen('ethics')}>AI Ethics</button>
      </nav>
    </footer>
  )
}

function PolicyModal({ type, onClose }) {
  const content = MODAL_CONTENT[type]
  if (!content) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>{content.title}</h3>
        <p>{content.body}</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export default App
