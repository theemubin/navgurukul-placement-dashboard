# Discord Integration Setup Guide

## 1. Create a Discord Bot
1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **New Application** and give it a name (e.g., "Placement Bot").
3.  Go to the **Bot** tab on the left sidebar.
4.  Click **Reset Token** to generate a new token. **Copy this token**—you will need it later.
5.  Under **Privileged Gateway Intents**, enable:
    *   `PRESENCE INTENT`
    *   `SERVER MEMBERS INTENT`
    *   `MESSAGE CONTENT INTENT` (Crucial for reading commands if added later)
6.  Click **Save Changes**.

## 2. Invite Bot to Your Server
1.  Go to the **OAuth2** -> **URL Generator** tab.
2.  Under **Scopes**, select `bot`.
3.  Under **Bot Permissions**, select:
    *   `Send Messages`
    *   `Create Public Threads`
    *   `Send Messages in Threads`
    *   `Manage Threads` (Optional, for locking old threads)
    *   `Embed Links` (Required for rich notifications)
    *   `Mention Everyone` (If you want @here alerts)
    *   `View Channels`
4.  Copy the **Generated URL** at the bottom.
5.  Open the URL in your browser and invite the bot to your target server.

## 3. Enable Developer Mode (to get IDs)
1.  Open Discord User Settings (Gear icon).
2.  Go to **Advanced**.
3.  Toggle **Developer Mode** ON.
4.  Now you can right-click any Server, Channel, or User and select **Copy ID**.

## 4. Configure Dashboard (Manager)
1.  Log in to the Placement Dashboard as a **Manager**.
2.  Go to **Settings** -> **Discord Integration** tab.
3.  **Enable Discord Integration**.
4.  Fill in the details:
    *   **Bot Token**: The token you copied in Step 1.
    *   **Guild (Server) ID**: Right-click your server icon -> Copy Server ID.
    *   **Jobs Channel ID**: Right-click the channel for new job posts -> Copy Channel ID.
    *   **Updates Channel ID**: Right-click the channel for general application updates -> Copy Channel ID.
    *   **Profiles Channel ID**: Right-click the channel for profile approvals -> Copy Channel ID.
5.  Click **Save All Changes**.
6.  **Restart the backend server** to initialize the bot with the new token.

## 5. Configure Campus-Specific Channels (Optional)
If you want notifications for specific campuses (e.g., "Pune Campus Profile Approved") to go to a separate channel:
1.  Create the channel in Discord (e.g., `#pune-updates`).
2.  Right-click and **Copy Channel ID**.
3.  In Dashboard, go to **Settings** -> **Campuses**.
4.  Click the **Edit Icon** next to the specific campus.
5.  Paste the **Channel ID** into the notification field.
6.  Click **Save**.

## 6. Job Threading Features
The system uses Discord Threads to keep updates organized.
*   **Automatic**: When a new job is posted, the bot creates a thread under the job posting. All status updates for that job are sent to that thread.
*   **Manual Override**:
    1.  Create a thread explicitly in Discord if needed.
    2.  Right-click the thread -> **Copy Channel ID** (Threads are channels).
    3.  In Dashboard -> **Coordinator** -> **Job Applicants (Triage)** -> Click **Review Decision**.
    4.  Enter the ID in the **"Discord Thread ID"** field before confirming.
    5.  Future updates for this job will now go to this manually linked thread.

## 7. User Linking
*   **Students/Coordinators**: Go to **Profile** settings. enter your **Discord User ID** (Right-click your profile in Discord -> Copy User ID).
*   This allows the bot to `mention` (@User) you when sending specific updates.

## 8. Notification Rules & Content
Below is the definitive logic for which activities trigger notifications and what information is shared.

### A. Job Postings
*   **Trigger**: When a coordinator creates or activates a job posting.
*   **Channel**: Global `Job Postings` channel.
*   **Campus Routing**: If the job is assigned to EXACTLY one campus, it will be sent to that campus's specific channel instead.
*   **Information Shared**:
    *   Job Title & Role
    *   Company Name & Logo
    *   Location & Job Type (Full-time, Internship, etc.)
    *   Salary Range (Rupees)
    *   Application Deadline
    *   Quick link to apply on the dashboard.
*   **Threading**: A management thread is automatically created for every job posting (if enabled).

### B. Application Status Updates
*   **Trigger**: When a coordinator changes a student's status (e.g., Shortlisted, Selected, Rejected).
*   **Channel**: Current `Job Thread` (if exists) or the `Updates Channel`.
*   **Campus Routing**: Preference is given to the student's campus-specific channel.
*   **Information Shared**:
    *   Student Name
    *   Job Role & Company
    *   New Status (with color-coded icons)
    *   Coordinator's Name who made the change
    *   Feedback/Comments (if provided)
*   **Mentions**: If the student has linked their Discord ID, they will be `@mentioned`.

### C. Profile & Verification
*   **Trigger**: When a manager approves a profile, marks it for revision, or when a student submits their profile.
*   **Channel**: `Profiles Channel` or Campus-specific channel.
*   **Information Shared**:
    *   Student Name & Photo
    *   Target Batch/Year
    *   Action taken (Approved/Revision Needed)
    *   Revision Notes (visible only in the notification)
*   **Mentions**: Direct `@mention` to the student for faster correction.

### D. Bulk Actions
*   **Trigger**: When a coordinator updates multiple students (e.g., "Shortlist all from Round 1").
*   **Channel**: Current `Job Thread`.
*   **Information Shared**:
    *   Total count of affected students
    *   The specific action performed
    *   List of student names (mentions are limited to 10 for readability).
