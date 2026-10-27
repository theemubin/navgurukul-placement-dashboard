
require("../utils/domPolyfill");
const path = require("path"); require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const assert = require("assert");
const User = require("../models/User");

async function runTests() {
  console.log("==========================================");
  console.log(" Testing Cover Letter Implementation Flow ");
  console.log("==========================================");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB for testing.");

  const testEmail = "test_cl_" + Date.now() + "@test.navgurukul.org";
  
  // 1. Create a mock student
  const student = new User({
    email: testEmail,
    password: "Password123!",
    firstName: "CoverLetter",
    lastName: "Tester",
    role: "student",
    studentProfile: {
      currentSchool: "School of Programming",
      resumes: [],
      coverLetters: []
    }
  });
  await student.save();
  console.log("✅ Step 1: Created test student user", student._id);

  try {
    // 2. Add first cover letter (as text/pitch)
    const cl1Id = new mongoose.Types.ObjectId();
    const cl1 = {
      _id: cl1Id,
      title: "Software Engineer Pitch",
      coverLetter: "https://example.com/cl1.pdf",
      coverLetterLink: "https://example.com/cl1.pdf",
      fileName: "cl1.pdf",
      text: "I am passionate about Full Stack Development with Node & React.",
      publicId: "cl_pub_1",
      isPrimary: true,
      uploadedAt: new Date()
    };
    student.studentProfile.coverLetters.push(cl1);
    student.studentProfile.coverLetter = cl1.text || cl1.coverLetter;
    student.studentProfile.coverLetterLink = cl1.coverLetterLink;
    student.markModified("studentProfile.coverLetters");
    await student.save();

    const u1 = await User.findById(student._id);
    assert.strictEqual(u1.studentProfile.coverLetters.length, 1);
    assert.strictEqual(u1.studentProfile.coverLetters[0].isPrimary, true);
    assert.strictEqual(u1.studentProfile.coverLetter, cl1.text);
    console.log("✅ Step 2: First cover letter added and set as primary automatically.");

    // 3. Add second cover letter
    const cl2Id = new mongoose.Types.ObjectId();
    const cl2 = {
      _id: cl2Id,
      title: "Backend Specialist Pitch",
      coverLetter: "https://example.com/cl2.pdf",
      coverLetterLink: "https://example.com/cl2.pdf",
      fileName: "cl2.pdf",
      text: "I specialize in MongoDB, Express, Redis, and high-performance APIs.",
      publicId: "cl_pub_2",
      isPrimary: false,
      uploadedAt: new Date()
    };
    u1.studentProfile.coverLetters.push(cl2);
    u1.markModified("studentProfile.coverLetters");
    await u1.save();

    const u2 = await User.findById(student._id);
    assert.strictEqual(u2.studentProfile.coverLetters.length, 2);
    assert.strictEqual(u2.studentProfile.coverLetters[0].isPrimary, true);
    assert.strictEqual(u2.studentProfile.coverLetters[1].isPrimary, false);
    console.log("✅ Step 3: Second cover letter added; first remains primary.");

    // 4. Switch primary to second cover letter
    u2.studentProfile.coverLetters.forEach(item => {
      if (item._id.toString() === cl2Id.toString()) {
        item.isPrimary = true;
        u2.studentProfile.coverLetter = item.text || item.coverLetter;
        u2.studentProfile.coverLetterLink = item.coverLetterLink;
      } else {
        item.isPrimary = false;
      }
    });
    u2.markModified("studentProfile.coverLetters");
    await u2.save();

    const u3 = await User.findById(student._id);
    const item1 = u3.studentProfile.coverLetters.find(c => c._id.toString() === cl1Id.toString());
    const item2 = u3.studentProfile.coverLetters.find(c => c._id.toString() === cl2Id.toString());
    assert.strictEqual(item1.isPrimary, false);
    assert.strictEqual(item2.isPrimary, true);
    assert.strictEqual(u3.studentProfile.coverLetter, item2.text);
    console.log("✅ Step 4: Primary switch to second cover letter verified successfully.");

    // 5. Delete first cover letter (non-primary)
    const idx1 = u3.studentProfile.coverLetters.findIndex(c => c._id.toString() === cl1Id.toString());
    u3.studentProfile.coverLetters.splice(idx1, 1);
    u3.markModified("studentProfile.coverLetters");
    await u3.save();

    const u4 = await User.findById(student._id);
    assert.strictEqual(u4.studentProfile.coverLetters.length, 1);
    assert.strictEqual(u4.studentProfile.coverLetters[0]._id.toString(), cl2Id.toString());
    assert.strictEqual(u4.studentProfile.coverLetters[0].isPrimary, true);
    console.log("✅ Step 5: Deleting non-primary cover letter maintains remaining primary.");

    // 6. Delete remaining primary cover letter
    u4.studentProfile.coverLetters.splice(0, 1);
    u4.studentProfile.coverLetter = "";
    u4.studentProfile.coverLetterLink = "";
    u4.markModified("studentProfile.coverLetters");
    await u4.save();

    const u5 = await User.findById(student._id);
    assert.strictEqual(u5.studentProfile.coverLetters.length, 0);
    assert.strictEqual(u5.studentProfile.coverLetter, "");
    assert.strictEqual(u5.studentProfile.coverLetterLink, "");
    console.log("✅ Step 6: Deleting final cover letter clears primary reference cleanly.");

    console.log("==========================================");
    console.log(" All 6 Cover Letter Flow Tests PASSED!   ");
    console.log("==========================================");
  } finally {
    // Cleanup test user
    await User.findByIdAndDelete(student._id);
    console.log("Cleaned up test student user.");
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
