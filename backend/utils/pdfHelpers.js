const fs = require('fs');

function truncate(text, len = 120) {
  if (!text) return '';
  if (text.length <= len) return text;
  return text.slice(0, len - 1) + '…';
}

function drawAvatar(doc, x, y, size, avatarPath, initials) {
  const radius = size / 2;
  try {
    if (avatarPath) {
      if (fs.existsSync(avatarPath)) {
        doc.save();
        // Draw avatar image
        doc.circle(x + radius, y + radius, radius).clip();
        doc.image(avatarPath, x, y, { width: size, height: size, fit: [size, size] });
        doc.restore();
        return;
      }
    }
  } catch (e) {
    // ignore
  }

  // Draw initials in circle
  doc.save();
  doc.circle(x + radius, y + radius, radius).fill('#e6eef8');
  doc.fillColor('#0b84ff').fontSize(Math.floor(size / 2)).text(initials || '', x, y + size * 0.15, { width: size, align: 'center' });
  doc.restore();
}

function drawIconEnvelope(doc, x, y, size, color = '#6b7280') {
  doc.save();
  doc.rect(x, y, size, size * 0.6).strokeColor(color).stroke();
  doc.moveTo(x, y).lineTo(x + size / 2, y + size * 0.3).lineTo(x + size, y).stroke();
  doc.restore();
}

function drawIconPhone(doc, x, y, size, color = '#6b7280') {
  doc.save();
  doc.roundedRect(x, y, size * 0.7, size, 2).strokeColor(color).stroke();
  doc.restore();
}

function drawIconLocation(doc, x, y, size, color = '#6b7280') {
  doc.save();
  const cx = x + size / 2;
  doc.circle(cx, y + size / 3, size / 3).strokeColor(color).stroke();
  doc.moveTo(cx - size / 6, y + size / 2).lineTo(cx, y + size).lineTo(cx + size / 6, y + size / 2).stroke();
  doc.restore();
}

function drawSkillBar(doc, x, y, label, rating, width) {
  const barHeight = 6;
  const barWidth = 100;
  const maxRating = 4;

  doc.fontSize(9).fillColor('#475569').font('Helvetica').text(label, x, y);

  const barX = x + width - barWidth;
  // Track background
  doc.roundedRect(barX, y + 2, barWidth, barHeight, 3).fill('#f1f5f9');

  // Progress bar
  const progress = (rating / maxRating) * barWidth;
  if (progress > 0) {
    const color = rating >= 3.5 ? '#1e40af' : rating >= 2.5 ? '#3b82f6' : '#94a3b8';
    doc.roundedRect(barX, y + 2, progress, barHeight, 3).fill(color);
  }
}

function drawIconLink(doc, x, y, label, url, color = '#2563eb') {
  if (!url) return;

  // Simple bullet/square instead of complex icon for stability
  doc.save();
  doc.rect(x, y + 2, 4, 4).fill(color);
  doc.restore();

  doc.fontSize(9).fillColor(color).font('Helvetica-Bold').text(label, x + 12, y, {
    link: url,
    underline: true
  });
}

function drawPortfolioProfile(doc, app, margin, y, w, h) {
  const student = app.student;
  const profile = student.studentProfile || {};

  // Left Sidebar
  const sidebarW = w * 0.32;
  const contentW = w - sidebarW - 40;
  const sidebarX = margin;
  const contentX = margin + sidebarW + 40;

  // Sidebar Background
  doc.roundedRect(sidebarX - 10, y - 10, sidebarW, h + 20, 10).fill('#f8fafc');

  let curY = y + 30;
  // Avatar
  drawAvatar(doc, sidebarX + (sidebarW / 2 - 40), curY, 80, student.avatar, `${student.firstName?.[0]}${student.lastName?.[0]}`);
  curY += 100;

  // Name
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text(`${student.firstName} ${student.lastName}`, sidebarX, curY, { width: sidebarW, align: 'center' });
  curY += 40;

  // Contact
  doc.fontSize(10).fillColor('#64748b').font('Helvetica-Bold').text('CONTACT INFO', sidebarX + 10, curY);
  curY += 20;

  const contactInfo = [
    { value: student.email, icon: 'envelope' },
    { value: student.phone, icon: 'phone' },
    { value: profile.hometown ? `${profile.hometown.district}, ${profile.hometown.state}` : null, icon: 'location' }
  ].filter(i => i.value);

  contactInfo.forEach(item => {
    doc.fontSize(8).fillColor('#334155').font('Helvetica').text(item.value, sidebarX + 12, curY, { width: sidebarW - 24 });
    curY += 15;
  });

  curY += 20;

  // Links
  doc.fontSize(10).fillColor('#64748b').font('Helvetica-Bold').text('PROFESSIONAL LINKS', sidebarX + 10, curY);
  curY += 20;

  const links = [
    { label: 'View Portfolio', url: profile.portfolio },
    { label: 'GitHub Profile', url: profile.github },
    { label: 'LinkedIn Profile', url: profile.linkedIn },
    { label: 'Resume Document', url: profile.resume }
  ].filter(l => l.url);

  links.forEach(link => {
    drawIconLink(doc, sidebarX + 10, curY, link.label, link.url);
    curY += 22;
  });

  // Right Content
  curY = y + 20;

  // Summary
  if (profile.about) {
    doc.fontSize(12).fillColor('#1e40af').font('Helvetica-Bold').text('PROFESSIONAL SUMMARY', contentX, curY);
    curY += 20;
    doc.fontSize(10).fillColor('#334155').font('Helvetica').lineGap(2).text(profile.about, contentX, curY, { width: contentW, align: 'justify' });
    curY += doc.heightOfString(profile.about, { width: contentW }) + 30;
  }

  // Education
  doc.fontSize(12).fillColor('#1e40af').font('Helvetica-Bold').text('ACADEMIC BACKGROUND', contentX, curY);
  curY += 20;

  // NG
  doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(profile.currentSchool || 'NavGurukul Foundation for Social Welfare', contentX, curY);
  doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Campus: ${student.campus?.name || '-'}  |  Program: ${profile.currentModule || '-'}`, contentX, curY + 12);
  curY += 35;

  if (profile.higherEducation?.length > 0) {
    profile.higherEducation.forEach(edu => {
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(`${edu.degree} - ${edu.institution}`, contentX, curY);
      doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`${edu.fieldOfStudy}  |  ${edu.startYear} - ${edu.endYear}`, contentX, curY + 12);
      curY += 35;
    });
  }

  // Skills
  doc.fontSize(12).fillColor('#1e40af').font('Helvetica-Bold').text('TECHNICAL PROFICIENCY', contentX, curY);
  curY += 20;

  const technicalSkills = profile.technicalSkills || [];
  technicalSkills.slice(0, 12).forEach(skill => {
    if (curY > y + h - 40) return;
    drawSkillBar(doc, contentX, curY, skill.skillName, skill.selfRating || 0, contentW);
    curY += 20;
  });

  // Footer Status
  const statusX = margin + sidebarW + 40;
  const statusY = y + h - 20;
  const statusText = `APPLICATION STATUS: ${(app.status || 'Applied').toUpperCase()}`;
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold').text(statusText, statusX, statusY);

  // Interest Request Status
  if (app.interestRequestStatus && app.interestRequestStatus !== 'Standard Application') {
    const interestStatusY = y + h - 35;
    const interestStatusText = `INTEREST REQUEST: ${app.interestRequestStatus.toUpperCase()}`;
    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text(interestStatusText, statusX, interestStatusY);
  }
}

module.exports = {
  drawAvatar,
  drawIconEnvelope,
  drawIconPhone,
  drawIconLocation,
  drawPortfolioProfile,
  truncate
};
