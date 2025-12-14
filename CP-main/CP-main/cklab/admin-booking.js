/* admin-booking.js - Complete Version (New Time Slot + Manage/Delete Fixed) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // Set Default Date Filter = Today
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) dateFilter.valueAsDate = new Date();

    // Render
    renderBookings();
});

// --- RENDER TABLE (แสดงตาราง) ---
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    const bookings = DB.getBookings();
    
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    // เรียงลำดับ (Status > PC > Time)
    filtered.sort((a, b) => {
        const statusPriority = {
            'reserved': 1,   // จอง (บนสุด)
            'in_use': 2,     // ใช้งานอยู่
            'completed': 3,  // เสร็จสิ้น
            'no_show': 4     // ไม่พบการใช้งาน (ล่างสุด)
        };
        
        const priorityA = statusPriority[a.status] || 3;
        const priorityB = statusPriority[b.status] || 3;
        
        if (priorityA !== priorityB) return priorityA - priorityB;

        const nameA = a.pcName || '';
        const nameB = b.pcName || '';
        const pcCompare = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        if (pcCompare !== 0) return pcCompare;

        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองในวันนี้</td></tr>`;
        return;
    }

    filtered.forEach(b => {
        let badgeClass = '';
        let statusText = '';
        let actionBtns = '';

        // กำหนดสีและปุ่มตามสถานะ
        switch(b.status) {
            case 'reserved':
                badgeClass = 'bg-warning text-dark'; 
                statusText = 'จอง';
                actionBtns = `<button class="btn btn-sm btn-outline-secondary" onclick="updateStatus('${b.id}', 'no_show')" title="แจ้ง No Show (ไม่มา)"><i class="bi bi-person-x"></i></button>`;
                break;
            case 'in_use':
                badgeClass = 'bg-danger'; 
                statusText = 'ใช้งานอยู่';
                actionBtns = `<button class="btn btn-sm btn-outline-success" onclick="updateStatus('${b.id}', 'completed')" title="เสร็จสิ้นการใช้งาน"><i class="bi bi-check-lg"></i></button>`;
                break;
            case 'completed':
                badgeClass = 'bg-success'; 
                statusText = 'ใช้งานเสร็จสิ้น';
                // ✅ แก้ไข: ตัดข้อความ "เรียบร้อย" ออก (ปล่อยว่าง)
                actionBtns = ``; 
                break;
            case 'no_show':
                badgeClass = 'bg-secondary'; 
                statusText = 'ไม่พบการใช้งาน';
                // ✅ แก้ไข: ปล่อยว่างเช่นกัน
                actionBtns = ``; 
                break;
            default:
                badgeClass = 'bg-light text-dark border'; 
                statusText = b.status;
        }

        // เพิ่มปุ่มลบ (ถังขยะ) ต่อท้ายเสมอ
        actionBtns += ` <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteBooking('${b.id}')" title="ลบรายการ"><i class="bi bi-trash"></i></button>`;

        let softwareDisplay = '-';
        if (b.softwareList && Array.isArray(b.softwareList)) {
            softwareDisplay = b.softwareList.map(sw => {
                if(sw === 'ซอฟต์แวร์ทั่วไป') return `<span class="badge bg-secondary bg-opacity-10 text-secondary border">General</span>`;
                return `<span class="badge bg-primary bg-opacity-10 text-primary border">${sw}</span>`;
            }).join(' ');
        } else if (b.note) {
            softwareDisplay = `<span class="text-muted small">${b.note}</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold">${b.userName}</div>
                <div class="small text-muted">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteBooking(id) {
    if(confirm('คุณต้องการลบรายการจองนี้ออกจากระบบใช่หรือไม่?')) {
        let bookings = DB.getBookings();
        const newBookings = bookings.filter(b => b.id !== id);
        DB.saveBookings(newBookings);
        renderBookings();
    }
}

// --- NEW MODAL FUNCTIONS (ส่วนใหม่ที่คุณเพิ่มเข้าไป) ---

function openBookingModal() {
    const pcs = DB.getPCs();
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '';
    pcs.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        select.appendChild(option);
    });

    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').valueAsDate = new Date();
    
    // รีเซ็ต Time Slot และ Type Select
    const timeSlot = document.getElementById('bkTimeSlot');
    if(timeSlot) timeSlot.selectedIndex = 0;
    
    const typeSelect = document.getElementById('bkTypeSelect');
    if(typeSelect) typeSelect.value = 'General';

    toggleSoftwareList();

    const container = document.getElementById('aiCheckboxList');
    container.innerHTML = '';
    const lib = DB.getSoftwareLib ? DB.getSoftwareLib() : [];
    const aiTools = lib.filter(item => item.type === 'AI');

    if (aiTools.length === 0) {
        container.innerHTML = '<span class="text-muted small">ไม่พบรายการ AI ในระบบ</span>';
    } else {
        aiTools.forEach(tool => {
            container.innerHTML += `
                <div class="col-6">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="aiSelect" value="${tool.name}" id="ai_${tool.id}">
                        <label class="form-check-label small" for="ai_${tool.id}">${tool.name}</label>
                    </div>
                </div>
            `;
        });
    }

    if(bookingModal) bookingModal.show();
}

function saveBooking() {
    const pcs = DB.getPCs();
    const pcId = document.getElementById('bkPcSelect').value;
    const pc = pcs.find(p => String(p.id) === String(pcId));

    const inputUser = document.getElementById('bkUser').value.trim();
    const regUser = DB.checkRegAPI(inputUser);
    
    let finalUserId = inputUser; 
    let finalUserName = inputUser; 

    if (regUser) {
        finalUserId = inputUser;
        finalUserName = regUser.prefix + regUser.name; 
    } else {
        finalUserId = 'Manual-' + Date.now(); 
    }

    // ดึงเวลาจาก Dropdown
    const timeSlotValue = document.getElementById('bkTimeSlot').value;
    const [startTime, endTime] = timeSlotValue.split('-');

    // ============================================================
    // 🛑 เริ่มส่วนตรวจสอบเวลาซ้ำ (เพิ่มใหม่ตรงนี้)
    // ============================================================
    const checkDate = document.getElementById('bkDate').value;
    const existingBookings = DB.getBookings();

    const conflict = existingBookings.find(b => {
        const isSamePc = String(b.pcId) === String(pcId);
        const isSameDate = b.date === checkDate;
        // เช็คทั้ง reserved และ in_use เพื่อกันพลาด
        const isNotAvailable = (b.status === 'reserved' || b.status === 'in_use');

        if (isSamePc && isSameDate && isNotAvailable) {
             // เช็คเวลาเหลื่อมกัน
             return (startTime < b.endTime && endTime > b.startTime);
        }
        return false;
    });

    if (conflict) {
        alert(`❌ ไม่สามารถจองได้!\nเครื่องนี้ถูกจองแล้วในช่วงเวลา ${conflict.startTime} - ${conflict.endTime}\n(โดย: ${conflict.userName})`);
        return; // หยุดการทำงาน ห้ามบันทึก
    }
    // ============================================================
    // สิ้นสุดส่วนตรวจสอบ
    // ============================================================

    // ตรวจสอบประเภท AI
    const typeSelect = document.getElementById('bkTypeSelect');
    const isAI = typeSelect && typeSelect.value === 'AI';

    let selectedTools = [];
    if (isAI) {
        const checkboxes = document.querySelectorAll('input[name="aiSelect"]:checked');
        selectedTools = Array.from(checkboxes).map(cb => cb.value);
    }
    const displaySoftware = isAI ? (selectedTools.length > 0 ? selectedTools : ['AI Work']) : ['ซอฟต์แวร์ทั่วไป'];

    const newBooking = {
        id: 'b' + Date.now(),
        userId: finalUserId,
        userName: finalUserName,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: checkDate, // ใช้ตัวแปร checkDate ที่ดึงมาแล้ว
        startTime: startTime,
        endTime: endTime,
        softwareList: displaySoftware,
        status: 'reserved'
    };

    let bookings = DB.getBookings();
    bookings.push(newBooking);
    DB.saveBookings(bookings);

    if(bookingModal) bookingModal.hide();
    renderBookings();
    alert(`✅ บันทึกการจองสำเร็จ\n(ผู้จอง: ${finalUserName})`);
}

function toggleSoftwareList() {
    const typeSelect = document.getElementById('bkTypeSelect');
    const isAI = typeSelect && typeSelect.value === 'AI';
    
    const box = document.getElementById('aiSelectionBox');
    if (box) {
        if (isAI) {
            box.classList.remove('d-none');
        } else {
            box.classList.add('d-none');
        }
    }
}