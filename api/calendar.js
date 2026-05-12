/**
 * Vercel Serverless Function - 动态生成/合并日历 ICS
 */

const fs = require('fs');
const path = require('path');
const ical = require('ical-generator');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { sources } = req.query;
    const sourcesList = sources ? sources.split(',') : ['holidays', 'lunar', 'solar', 'festivals'];
    
    const sourceMap = {
      'holidays': 'china-holidays.ics',
      'lunar': 'lunar-calendar.ics',
      'solar': 'solar-terms.ics',
      'yiji': 'yi-ji.ics',
      'festivals': 'festivals.ics'
    };
    
    // 如果只请求一个源，直接返回该文件
    if (sourcesList.length === 1) {
      const fileName = sourceMap[sourcesList[0]];
      if (fileName) {
        const filePath = path.join(process.cwd(), 'output', fileName);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf8");
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
          res.setHeader('Cache-Control', 's-maxage=3600');
          return res.status(200).send(content);
        }
      }
    }
    
    // 多个源：合并
    const calendar = ical({ name: '定制日历订阅' });
    
    for (const source of sourcesList) {
      const fileName = sourceMap[source];
      if (!fileName) continue;
      
      const filePath = path.join(process.cwd(), 'output', fileName);
      if (!fs.existsSync(filePath)) continue;
      
      const icsContent = fs.readFileSync(filePath, "utf8");
      const events = parseICS(icsContent);
      
      events.forEach(event => {
        try {
          calendar.createEvent({
            start: event.start,
            end: event.end,
            summary: event.summary,
            description: event.description,
            allDay: event.allDay
          });
        } catch (e) {
          // 跳过无效事件
        }
      });
    }
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).send(calendar.toString());
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split('\n');
  let currentEvent = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.start && currentEvent.summary) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (trimmed.startsWith('DTSTART')) {
        const value = trimmed.split(':')[1];
        currentEvent.start = parseICSDate(value);
        currentEvent.allDay = !value.includes('T');
      } else if (trimmed.startsWith('DTEND')) {
        const value = trimmed.split(':')[1];
        currentEvent.end = parseICSDate(value);
      } else if (trimmed.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmed.substring(8);
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        currentEvent.description = trimmed.substring(12);
      }
    }
  }
  
  return events;
}

function parseICSDate(value) {
  if (!value) return null;
  
  const year = parseInt(value.substring(0, 4));
  const month = parseInt(value.substring(4, 6)) - 1;
  const day = parseInt(value.substring(6, 8));
  
  if (value.length >= 13) {
    const hour = parseInt(value.substring(9, 11));
    const minute = parseInt(value.substring(11, 13));
    return new Date(Date.UTC(year, month, day, hour, minute, 0));
  }
  
  return new Date(Date.UTC(year, month, day));
}
