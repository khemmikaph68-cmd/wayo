/* feedback.js - Final Fix: Stability and Full Session Check-out */

let currentRate = 5; // คะแนนที่ถูกเลือก
let sessionData = null; // เก็บข้อมูล Session ที่โหลดมา

// ข้อความและสีบรรยายระดับคะแนน (ใช้ในการแสดงผล)
const RATING_TEXTS = {
    1: "ต้องปรับปรุง", 2: "พอใช้", 3: "ปานกลาง", 4: "ดี", 5: "ยอดเยี่ยม"
};
const RATING_COLORS = {
    1: "#dc3545", 2: "#dc3545", 3: "#ffc107", 4: "#28a745", 5: "#198754"
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. โหลด Session Data
    sessionData = DB.getSession();
    
    // ตรวจสอบ Session และข้อมูลสำคัญ
    if (!sessionData || !sessionData.startTime || !sessionData.pcId) {
        alert('❌ Error: ไม่พบ Session หรือ PC ID กรุณาลงชื่อเข้าใช้ใหม่');
        window.location.href = 'index.html';
        return;
    }
    
    // 2. แสดงข้อมูลระยะเวลา
    const durationMinutes = sessionData.durationMinutes || 0;
    const durationDisplay = document.getElementById('durationDisplay');
    if (durationDisplay) {
        durationDisplay.textContent = `${durationMinutes} นาที`;
    }

    // 3. ตั้งค่าเริ่มต้นที่ 5 ดาว (Default)
    setRate(5);
});

// --- 1. ฟังก์ชันจัดการดาวและการให้คะแนน ---

function getStarElements() {
    return document.querySelectorAll('#starContainer span');
}

function setRate(rate) {
    currentRate = rate;
    const stars = getStarElements();
    if (stars.length === 0) return;

    stars.forEach((star, index) => {
        star.classList.toggle('active', index < rate);
        star.classList.remove('hover-active');
    });
    updateRateText(rate);
}

function updateRateText(rate) {
    const txtElement = document.getElementById('rateText');
    if (txtElement) {
        txtElement.innerText = `${RATING_TEXTS[rate]} (${rate}/5)`;
        txtElement.style.color = RATING_COLORS[rate];
    }
}

function hoverStar(rate) {
    const stars = getStarElements();
    if (stars.length === 0) return;
    stars.forEach((star, index) => {
        star.classList.toggle('hover-active', index < rate);
    });
}

function resetHover() {
    const stars = getStarElements();
    if (stars.length === 0) return;
    stars.forEach(star => star.classList.remove('hover-active'));
}


// --- 3. ฟังก์ชันส่งข้อมูล (Submit) - FIXED ---

function submitFeedback() {
    const session = sessionData; // ใช้ข้อมูล Session ที่โหลดไว้ตอน DOMContentLoaded
    
    if (!session || !session.pcId) {
        alert("❌ Error: Session ขาดหาย ไม่สามารถบันทึก Check-out ได้");
        window.location.href = 'index.html';
        return;
    }
    
    const pcId = session.pcId;
    const pc = DB.getPCs().find(p => p.id == pcId); 
    
    const satisfactionScore = currentRate; 
    const comment = document.getElementById('comment').value.trim();
    
    // ป้องกันการกดซ้ำ
    const submitButton = document.querySelector('.btn-primary');
    submitButton.disabled = true;

    try {
        // 1. ตรวจสอบความสมบูรณ์ของ PC Data ก่อน Log
        if (!pc) {
             throw new Error(`PC ID ${pcId} not found in DB.`);
        }

        // 👇👇 [เพิ่มส่วนนี้ครับ] อัปเดตสถานะ Booking เป็น "เสร็จสิ้น" 👇👇
        const bookings = DB.getBookings();
        // ค้นหาการจองของเครื่องนี้ ที่สถานะกำลัง "ใช้งานอยู่"
        const bookingIndex = bookings.findIndex(b => 
            String(b.pcId) === String(pcId) && b.status === 'in_use'
        );

        if (bookingIndex !== -1) {
            bookings[bookingIndex].status = 'completed'; // เปลี่ยนเป็นสีเขียว
            DB.saveBookings(bookings);
        }
        
        // 2. บันทึก Log สิ้นสุด Session ที่สมบูรณ์
        const user = session.user || {};
        
        DB.saveLog({
            action: 'END_SESSION', 
            userId: user.id || 'N/A',
            userName: user.name || 'N/A',
            userFaculty: user.faculty || 'N/A',
            userLevel: user.level || 'N/A',
            userYear: user.year || 'N/A',
            userRole: user.role || 'N/A',
            pcId: pcId,
            
            startTime: new Date(session.startTime).toISOString(),
            timestamp: new Date().toISOString(), 
            durationMinutes: session.durationMinutes, 
            satisfactionScore: satisfactionScore, 
            comment: comment, 
            
            // ✅ แก้ไขชื่อตัวแปรให้ถูกต้องตรงนี้
            usedSoftware: pc.installedSoftware || [], 
            isAIUsed: (pc.installedSoftware || []).some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('gpt'))
        });

        // 3. อัปเดตสถานะ PC
        DB.updatePCStatus(pcId, 'available', null);

        // 4. ล้าง Session 
        DB.clearSession(); 

        // 5. แสดง Popup และ Redirect
        setTimeout(() => {
            alert(`✅ บันทึกข้อมูลเรียบร้อย (คะแนน: ${satisfactionScore}/5)\nขอบคุณที่ใช้บริการ CKLab ครับ`);
            window.location.href = `index.html?pc=${pcId}`; 
        }, 300);

    } catch (error) {
        console.error("Critical Feedback Submission Error:", error);
        alert("❌ เกิดข้อผิดพลาดร้ายแรงในการบันทึกข้อมูล Log (โปรดแจ้งเจ้าหน้าที่)");
        submitButton.disabled = false;
    }
}