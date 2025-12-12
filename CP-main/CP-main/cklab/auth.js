/* auth.js - Fixed Station Version (Updated with Booking Support) */

// ==========================================
// 🔧 SYSTEM CONFIG: ดึงเลขเครื่องจาก URL (เช่น index.html?pc=1)
// ==========================================
function getSystemPCId() {
    if (window.location.hash) {
        let id = window.location.hash.replace('#', '').replace(/pc-/i, '');
        return parseInt(id).toString();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('pc');
}

const FIXED_PC_ID = getSystemPCId(); 
// ==========================================

let verifiedUserData = null; // เก็บข้อมูลผู้ใช้ที่ Verify แล้ว (Internal)
let activeTab = 'internal';

document.addEventListener('DOMContentLoaded', () => {
    // เช็คว่ามีเลขเครื่องไหม
    if (!FIXED_PC_ID || isNaN(parseInt(FIXED_PC_ID))) {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100 flex-column text-center">
                <h2 class="text-danger">⚠️ ไม่พบหมายเลขเครื่อง (PC ID)</h2>
                <p class="text-muted">กรุณาระบุเลขเครื่องใน URL เพื่อเริ่มใช้งาน<br>ตัวอย่าง: <code>index.html?pc=1</code></p>
                <a href="index.html?pc=1" class="btn btn-primary mt-3">ทดลองเข้าใช้งานเครื่องที่ 1</a>
            </div>
        `;
        return;
    }

    checkMachineStatus();

    const extInputs = document.querySelectorAll('#formExternal input');
    extInputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });
});

function checkMachineStatus() {
    const displayId = document.getElementById('fixedPcIdDisplay');
    if(displayId) displayId.innerText = `PC-${FIXED_PC_ID.padStart(2, '0')}`;

    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    if (!pc) {
        alert(`System Error: ไม่พบการตั้งค่าเครื่องหมายเลข ${FIXED_PC_ID} ใน Database`);
        return;
    }
    
    // อัปเดตสถานะ Dot
    const indicator = document.querySelector('.status-indicator');
    if(indicator) {
        indicator.className = 'status-indicator'; // Reset class
        indicator.classList.add(
            `bg-${pc.status === 'available' ? 'success' : 
                   pc.status === 'in_use' ? 'danger' : 
                   pc.status === 'reserved' ? 'warning' : 'secondary'}`
        );
        indicator.title = pc.status.toUpperCase();
    }
    
    // ถ้าเครื่อง In Use อยู่แล้ว ให้เด้งไปหน้า Timer เลย (Resume)
    if (pc.status === 'in_use') {
         const currentSession = DB.getSession();
         if (!currentSession || currentSession.pcId != FIXED_PC_ID) {
              DB.setSession({
                   pcId: FIXED_PC_ID,
                   user: { name: pc.currentUser || 'Unknown User' },
                   startTime: pc.startTime || Date.now()
              });
         }
         window.location.href = 'timer.html';
    } 
}

function switchTab(type) {
    activeTab = type;
    verifiedUserData = null;
    document.getElementById('tab-internal').classList.toggle('active', type === 'internal');
    document.getElementById('tab-external').classList.toggle('active', type === 'external');
    document.getElementById('formInternal').classList.toggle('d-none', type !== 'internal');
    document.getElementById('formExternal').classList.toggle('d-none', type !== 'external');
    document.getElementById('internalVerifyCard').style.display = 'none';
    
    // Reset Form สำหรับ Internal
    if (type === 'internal') {
        document.getElementById('ubuUser').value = '';
    }

    validateForm();
}

function verifyUBUUser() {
    const id = document.getElementById('ubuUser').value.trim();
    if(!id) return alert("กรุณากรอกรหัส");
    
    const user = DB.checkRegAPI(id);
    const verifyCard = document.getElementById('internalVerifyCard');
    
    if (user) {
        // ✅ ข้อมูล User สมบูรณ์
        verifiedUserData = { 
            id: id, 
            name: user.prefix + user.name, 
            faculty: user.faculty, 
            role: user.role, 
            level: user.level, 
            year: user.year 
        };

        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        document.getElementById('showRole').innerText = verifiedUserData.role.toUpperCase();
        
        verifyCard.style.display = 'block';
        validateForm();
    } else {
        alert("❌ ไม่พบข้อมูล (Hint: 66123456)");
        verifyCard.style.display = 'none';
        verifiedUserData = null;
        validateForm();
    }
}

// ✅ ฟังก์ชันตรวจสอบปุ่มกด (แก้ไขให้รองรับสถานะ Reserved)
function validateForm() {
    let isUserValid = false;
    const btn = document.getElementById('btnConfirm');
    
    if (activeTab === 'internal') {
        isUserValid = (verifiedUserData !== null);
    } else {
        const id = document.getElementById('extIdCard').value.trim();
        const name = document.getElementById('extName').value.trim();
        isUserValid = (id !== '' && name !== '');
    }
    
    // ตรวจสอบสถานะเครื่อง
    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    // ยอมรับทั้งสถานะ 'available' (ว่าง) และ 'reserved' (จอง)
    const isMachineAvailable = pc && (pc.status === 'available' || pc.status === 'reserved');

    if (isUserValid && isMachineAvailable) {
        btn.disabled = false;
        btn.classList.replace('btn-secondary', 'btn-success');

        if (pc.status === 'reserved') {
            btn.innerHTML = '<i class="bi bi-calendar-check me-2"></i>ยืนยันการจองเพื่อเข้าใช้งาน';
       } else {
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>เข้าสู่ระบบและเริ่มใช้งาน';
       }
    } else {
        btn.disabled = true;
        btn.classList.replace('btn-success', 'btn-secondary');
        if (!isMachineAvailable) {
            btn.textContent = `❌ PC-${FIXED_PC_ID} ไม่ว่าง (${pc ? pc.status : 'N/A'})`;
        } else {
            btn.textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน';
        }
    }
}

// ✅ ฟังก์ชันยืนยันการเข้าใช้งาน (แก้ไขให้เช็คชื่อหรือรหัสสำหรับการจอง)
function confirmCheckIn() {
    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    // 1. ตรวจสอบสถานะเครื่อง
    if (pc.status !== 'available' && pc.status !== 'reserved') {
        return alert("❌ ขออภัย เครื่องนี้ไม่พร้อมใช้งาน (สถานะ: " + pc.status + ")");
    }

    let finalUser = null;
    const usageTypeElement = document.querySelector('input[name="usageType"]:checked');
    const usageType = usageTypeElement ? usageTypeElement.value : 'walkin';

    // เตรียมข้อมูลผู้ใช้
    if (activeTab === 'internal') {
        finalUser = verifiedUserData;
    } else {
        finalUser = {
            id: document.getElementById('extIdCard').value.trim(),
            name: document.getElementById('extName').value.trim(),
            faculty: document.getElementById('extOrg').value.trim() || 'บุคคลทั่วไป',
            role: 'external',
            level: 'N/A',
            year: 'N/A'
        };
    }

    // 2. Logic ตรวจสอบการจอง (Booking Validation)
    if (usageType === 'booking') {
        const bookings = DB.getBookings();
        
        // วันที่ปัจจุบัน (YYYY-MM-DD)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const bookingIndex = bookings.findIndex(b => {
            // 1. ต้องเป็นเครื่องนี้ และ วันนี้ และสถานะ 'reserved'
            const isTarget = String(b.pcId) === String(FIXED_PC_ID) && b.date === todayStr && b.status === 'reserved';
            
            // 2. ตรวจสอบผู้ใช้: รหัสตรง หรือ ชื่อตรง (อย่างใดอย่างหนึ่ง)
            const idMatch = String(b.userId).trim() === String(finalUser.id).trim();
            const nameMatch = b.userName.trim() === finalUser.name.trim();

            return isTarget && (idMatch || nameMatch);
        });

        if (bookingIndex === -1) {
            return alert("❌ ไม่พบข้อมูลการจองที่ถูกต้อง!\n\n- กรุณาตรวจสอบว่าคุณจอง 'เครื่องนี้' และ 'วันที่นี้' มาแล้ว\n- ชื่อหรือรหัสต้องตรงกับที่จองไว้\n- สถานะการจองต้องเป็น 'จอง' (สีเหลือง) เท่านั้น");
        }

        // ✅ เจอการจอง: เปลี่ยนสถานะเป็น 'in_use'
        bookings[bookingIndex].status = 'in_use';
        DB.saveBookings(bookings);

    } else {
        // 3. กรณี Walk-in แต่เครื่องสถานะ Reserved
        if (pc.status === 'reserved') {
            return alert("⚠️ เครื่องนี้สถานะ 'จอง' (Reserved)\nถูกจองไว้สำหรับผู้ใช้อื่น กรุณาเลือกเครื่องอื่นครับ");
        }
    }

    // 4. อัปเดตสถานะ PC ใน Monitor
    const startTime = Date.now();
    DB.updatePCStatus(FIXED_PC_ID, 'in_use', finalUser.name);
    
    // 5. บันทึก Session
    DB.setSession({ 
        user: finalUser, 
        pcId: FIXED_PC_ID, 
        startTime: startTime, 
        usageType: usageType 
    });

    // 6. บันทึก Log History
    DB.saveLog({ 
        action: 'START_SESSION', 
        userId: finalUser.id, 
        userName: finalUser.name, 
        userFaculty: finalUser.faculty,
        userLevel: finalUser.level,
        userYear: finalUser.year,
        userRole: finalUser.role,
        pcId: FIXED_PC_ID, 
        startTime: new Date(startTime).toISOString(),
        durationMinutes: 0,
        usedSoftware: pc.installedSoftware || [], 
        isAIUsed: (pc.installedSoftware || []).some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('gpt'))
    });

    alert(`✅ ลงชื่อเข้าใช้งานสำเร็จ!\n\nสวัสดีคุณ ${finalUser.name}\nระบบจะเริ่มจับเวลาการใช้งาน ณ บัดนี้`);
    window.location.href = 'timer.html';
}