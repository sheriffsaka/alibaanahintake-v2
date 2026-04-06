import { Student, AppointmentSlot, Level, Gender, AdminUser, Role, NotificationSettings, AppSettings, Program, SiteContent } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock Database
const students: Student[] = [];
let appointmentSlots: AppointmentSlot[] = [];
let levels: Level[] = [
    { id: 'level-1', name: 'Beginner', isActive: true, sortOrder: 1 },
    { id: 'level-2', name: 'Elementary', isActive: true, sortOrder: 2 },
    { id: 'level-3', name: 'Intermediate', isActive: true, sortOrder: 3 },
    { id: 'level-4', name: 'Advanced', isActive: false, sortOrder: 4 },
];
let programs: Program[] = [
    { id: 'prog-1', name: 'Calligraphy Classes', isActive: true, isArchived: false, sortOrder: 1, children: [] },
    { id: 'prog-2', name: 'Mutoon Class', isActive: true, isArchived: false, sortOrder: 2, children: [] },
    { id: 'prog-3', name: 'Advanced Grammar', parentId: 'prog-2', isActive: true, isArchived: false, sortOrder: 1, children: [] },
    { id: 'prog-4', name: 'Archived Program', isActive: true, isArchived: true, sortOrder: 3, children: [] },
];
let adminUsers: AdminUser[] = [
    { id: 'user-1', name: 'Super Admin', email: 'super@al-ibaanah.com', role: Role.SuperAdmin, isActive: true },
    { id: 'user-2', name: 'Ahmed Ali', email: 'male.admin@al-ibaanah.com', role: Role.MaleAdmin, isActive: true },
    { id: 'user-3', name: 'Fatima Zahra', email: 'female.admin@al-ibaanah.com', role: Role.FemaleAdmin, isActive: true },
    { id: 'user-4', name: 'Yusuf Ibrahim', email: 'male.desk@al-ibaanah.com', role: Role.MaleFrontDesk, isActive: true },
    { id: 'user-5', name: 'Aisha Omar', email: 'female.desk@al-ibaanah.com', role: Role.FemaleFrontDesk, isActive: false },
];
const siteContent: SiteContent = {
    logoUrl: "https://res.cloudinary.com/di7okmjsx/image/upload/v1771428370/alibaanahlogo1_iprhyj.png",
    officialSiteUrl: "https://ibaanah.com/",
    heroVideoUrl: { 
        en: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        ar: "https://www.youtube.com/embed/CenZeeJ3m_4"
    },
    faqItems: {
        en: [
            { question: "Do I need to register on the main site first?", answer: "Yes, the first step is always to complete the main registration on the official Al-Ibaanah website. This portal is for booking your mandatory on-campus booking slot after you have registered." },
            { question: "What happens during the booking?", answer: "The on-campus booking is a friendly meeting with one of our instructors to gauge your current Arabic language proficiency. This helps us place you in the perfect level to ensure your success." }
        ],
        ar: [
            { question: "هل يجب أن أسجل في الموقع الرئيسي أولاً؟", answer: "نعم، الخطوة الأولى دائمًا هي إكمال التسجيل الرئيسي على موقع الإبانة الرسمي. هذه البوابة مخصصة لحجز موعد الحجز الإلزامي في الحرم الجامعي بعد التسجيل." },
        ],
        fr: [
            { question: "Dois-je m'inscrire d'abord sur le site principal ?", answer: "Oui, la première étape est toujours de compléter l'inscription principale sur le site officiel d'Al-Ibaanah. Ce portail sert à réserver votre créneau de réservation obligatoire sur le campus après votre inscription." }
        ],
        zh: [
            { question: "我需要先在主站点注册吗？", answer: "是的，第一步总是在 Al-Ibaanah 官方网站上完成主注册。此门户用于在您注册后预订您的强制性校内预约时段。" }
        ],
        ru: [
            { question: "Нужно ли мне сначала регистрироваться на основном сайте?", answer: "Да, первым шагом всегда является завершение основной регистрации на официальном сайте Al-Ibaanah. Этот портал предназначен для бронирования обязательного времени для бронирования в кампусе после вашей регистрации." }
        ],
        uz: [
            { question: "Avval asosiy saytda roʻyxatdan oʻtishim kerakmi?", answer: "Ha, birinchi qadam har doim Al-Ibaanah rasmiy veb-saytida asosiy ro'yxatdan o'tishni yakunlashdir. Ushbu portal ro'yxatdan o'tganingizdan so'ng majburiy kampusda bron qilish vaqtini bron qilish uchun mo'ljallangan." }
        ]
    },
    campusAddress: "Block 12, Rd 18, Nasr City, Cairo, Egypt",
    campusHours: "Sunday - Thursday, 9:00 AM - 2:00 PM"
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notificationSettings: any = {
    en: {
        confirmation: {
            enabled: true,
            subject: 'Your Al-Ibaanah Booking is Confirmed!',
            body: '## **Registration Confirmation**\n\n**Dear {{studentName}},**\n\nYour slot booking for **{{level}}** registration on campus has been successfully confirmed.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: 'Reminder: Your Al-Ibaanah Booking is Tomorrow',
            body: '## **Registration Reminder**\n\n**Dear {{studentName}},**\n\nThis is a reminder that your slot booking for **{{level}}** registration on campus is scheduled for tomorrow.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: 'Reminder: Your Al-Ibaanah Booking is Today',
            body: '## **Registration Reminder**\n\n**Dear {{studentName}},**\n\nThis is a reminder that your slot booking for **{{level}}** registration on campus is scheduled for today.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909',
        },
    },
    ar: {
        confirmation: {
            enabled: true,
            subject: 'تم تأكيد حجزك في معهد الإبانة!',
            body: '## **تأكيد التسجيل**\n\n**عزيزي {{studentName}}،**\n\nتم تأكيد حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي بنجاح.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: 'تذكير: موعد حجزك في معهد الإبانة غداً',
            body: '## **تذكير بالتسجيل**\n\n**عزيزي {{studentName}}،**\n\nهذا تذكير بأن حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي مقرر غداً.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: 'تذكير: موعد حجزك في معهد الإبانة اليوم',
            body: '## **تذكير بالتسجيل**\n\n**عزيزي {{studentName}}،**\n\nهذا تذكير بأن حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي مقرر اليوم.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909',
        },
    },
    fr: {
        confirmation: {
            enabled: true,
            subject: 'Votre réservation Al-Ibaanah est confirmée !',
            body: '## **Confirmation d\'inscription**\n\n**Cher {{studentName}},**\n\nVotre créneau pour l\'inscription au **{{level}}** sur le campus a été confirmé avec succès.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d\'admission** ci-jointe. Nous vous prions d\'apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l\'inscription.\n\n> **Note importante :** L\'inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l\'intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d\'un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: 'Rappel : Votre réservation Al-Ibaanah est demain',
            body: '## **Rappel d\'inscription**\n\n**Cher {{studentName}},**\n\nCeci est un rappel que votre créneau pour l\'inscription au **{{level}}** sur le campus est prévu pour demain.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d\'admission** ci-jointe. Nous vous prions d\'apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l\'inscription.\n\n> **Note importante :** L\'inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l\'intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d\'un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: 'Rappel : Votre réservation Al-Ibaanah est aujourd\'hui',
            body: '## **Rappel d\'inscription**\n\n**Cher {{studentName}},**\n\nCeci est un rappel que votre créneau pour l\'inscription au **{{level}}** sur le campus est prévu pour aujourd\'hui.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d\'admission** ci-jointe. Nous vous prions d\'apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l\'inscription.\n\n> **Note importante :** L\'inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l\'intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d\'un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909',
        },
    },
    zh: {
        confirmation: {
            enabled: true,
            subject: '您的 Al-Ibaanah 预约已确认！',
            body: '## **注册确认**\n\n**亲爱的 {{studentName}}：**\n\n您在校园进行的 **{{level}}** 注册预约已确认成功。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: '提醒：您的 Al-Ibaanah 预约在明天',
            body: '## **注册提醒**\n\n**亲爱的 {{studentName}}：**\n\n提醒您，您在校园进行的 **{{level}}** 注册预约定于明天。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: '提醒：您的 Al-Ibaanah 预约在今天',
            body: '## **注册提醒**\n\n**亲爱的 {{studentName}}：**\n\n提醒您，您在校园进行的 **{{level}}** 注册预约定于今天。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909',
        },
    },
    uz: {
        confirmation: {
            enabled: true,
            subject: 'Al-Ibaanah band qilinganligingiz tasdiqlandi!',
            body: '## **Ro\'yxatdan o\'tishni tasdiqlash**\n\n**Hurmatli {{studentName}},**\n\nKampusda **{{level}}** uchun ro\'yxatdan o\'tish vaqtingiz muvaffaqiyatli tasdiqlandi.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko\'rib chiqing. Ro\'yxatdan o\'tishni davom ettirish uchun barcha kerakli hujjatlarni va to\'lovlarni o\'zingiz bilan olib kelishingizni so\'raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to\'liq taqdim etmagan talabalar ro\'yxatdan o\'tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro\'yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o\'lchamidagi fotosurat (agar siz qaytib kelgan talaba bo\'lsangiz, 1 ta).\n* **To\'lov:** O\'quv to\'lovi yoki allaqachon to\'langan bo\'lsa, to\'lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog\'lanish uchun ma\'lumotlar:**\n* **Erkaklar / Birodarlar bo\'limi:** +201112335628\n* **Ayollar / Opa-singillar bo\'limi:** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: 'Eslatma: Al-Ibaanah band qilinganligingiz ertaga',
            body: '## **Ro\'yxatdan o\'tish haqida eslatma**\n\n**Hurmatli {{studentName}},**\n\nBu kampusdagi **{{level}}** uchun ro\'yxatdan o\'tish vaqtingiz ertaga ekanligi haqida eslatma.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko\'rib chiqing. Ro\'yxatdan o\'tishni davom ettirish uchun barcha kerakli hujjatlarni va to\'lovlarni o\'zingiz bilan olib kelishingizni so\'raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to\'liq taqdim etmagan talabalar ro\'yxatdan o\'tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro\'yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o\'lchamidagi fotosurat (agar siz qaytib kelgan talaba bo\'lsangiz, 1 ta).\n* **To\'lov:** O\'quv to\'lovi yoki allaqachon to\'langan bo\'lsa, to\'lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog\'lanish uchun ma\'lumotlar:**\n* **Erkaklar / Birodarlar bo\'limi:** +201112335628\n* **Ayollar / Opa-singillar bo\'limi:** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: 'Eslatma: Al-Ibaanah band qilinganligingiz bugun',
            body: '## **Ro\'yxatdan o\'tish haqida eslatma**\n\n**Hurmatli {{studentName}},**\n\nBu kampusdagi **{{level}}** uchun ro\'yxatdan o\'tish vaqtingiz bugun ekanligi haqida eslatma.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko\'rib chiqing. Ro\'yxatdan o\'tishni davom ettirish uchun barcha kerakli hujjatlarni va to\'lovlarni o\'zingiz bilan olib kelishingizni so\'raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to\'liq taqdim etmagan talabalar ro\'yxatdan o\'tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro\'yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o\'lchamidagi fotosurat (agar siz qaytib kelgan talaba bo\'lsangiz, 1 ta).\n* **To\'lov:** O\'quv to\'lovi yoki allaqachon to\'langan bo\'lsa, to\'lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog\'lanish uchun ma\'lumotlar:**\n* **Erkaklar / Birodarlar bo\'limi:** +201112335628\n* **Ayollar / Opa-singillar bo\'limi:** +201009537909',
        },
    },
    ru: {
        confirmation: {
            enabled: true,
            subject: 'Ваше бронирование в Al-Ibaanah подтверждено!',
            body: '## **Подтверждение регистрации**\n\n**Уважаемый {{studentName}}!**\n\nВаша запись на регистрацию на **{{level}}** успешно подтверждена.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909',
        },
        reminder24h: {
            enabled: true,
            subject: 'Напоминание: Ваше бронирование в Al-Ibaanah завтра',
            body: '## **Напоминание о регистрации**\n\n**Уважаемый {{studentName}}!**\n\nЭто напоминание о том, что ваша запись на регистрацию на **{{level}}** запланирована на завтра.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909',
        },
        reminderDayOf: {
            enabled: false,
            subject: 'Напоминание: Ваше бронирование в Al-Ibaanah сегодня',
            body: '## **Напоминание о регистрации**\n\n**Уважаемый {{studentName}}!**\n\nЭто напоминание о том, что ваша запись на регистрацию на **{{level}}** запланирована на сегодня.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909',
        },
    },
};
let appSettings: AppSettings = { isRegistrationOpen: true, maxDailyCapacity: 100 };

const generateMockData = () => {
  if (appointmentSlots.length > 0) return;
  const today = new Date();
  const dates = [0, 1, 2, 7, 8].map(d => {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    return date.toISOString().split('T')[0];
  });
  const times = [ { start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }];
  const genders = [Gender.Male, Gender.Female];
  dates.forEach(date => levels.forEach(level => times.forEach(time => genders.forEach(gender => {
    const capacity = Math.floor(Math.random() * 5) + 5;
    appointmentSlots.push({
      id: uuidv4(), date, level, levelId: level.id, startTime: time.start, endTime: time.end, capacity,
      booked: Math.floor(Math.random() * capacity),
      gender: gender,
    });
  }))));
};
generateMockData();

const simulateDelay = <T,>(data: T): Promise<T> => 
    new Promise(resolve => setTimeout(() => resolve(data === undefined ? data : JSON.parse(JSON.stringify(data))), 300));

// --- Auth ---
export const login = async (email: string, password: string): Promise<void> => {
    if (password === 'password123') {
        const user = adminUsers.find(u => u.email === email);
        if (user) return simulateDelay(undefined);
    }
    throw new Error('Invalid credentials.');
}
export const logout = async (): Promise<void> => simulateDelay(undefined);
export const getAdminUserProfile = async (userId: string): Promise<AdminUser | null> => simulateDelay(adminUsers.find(u => u.id === userId) || null);


// --- Public API ---
export const getAvailableDatesForLevel = async(levelId: string, gender: Gender): Promise<string[]> => {
    if (!appSettings.isRegistrationOpen) return simulateDelay([]);
    const availableDates = appointmentSlots.filter(s => s.levelId === levelId && s.gender === gender && s.booked < s.capacity).map(s => s.date);
    return simulateDelay([...new Set(availableDates)].sort());
}

export const getAvailableSlots = async (date: string, levelId: string, gender: Gender): Promise<AppointmentSlot[]> => {
    if (!appSettings.isRegistrationOpen) return simulateDelay([]);
    return simulateDelay(appointmentSlots.filter(s => s.date === date && s.levelId === levelId && s.gender === gender));
};

export const submitRegistration = async (formData: Omit<Student, 'id' | 'registrationCode' | 'appointmentSlotId' | 'status' | 'createdAt' | 'level'> & { appointmentSlotId: string }): Promise<Student> => {
    const slot = appointmentSlots.find(s => s.id === formData.appointmentSlotId);
    if (!slot || slot.booked >= slot.capacity) throw new Error("Slot is full or does not exist.");
    const studentLevel = levels.find(l => l.id === formData.levelId);
    if (!studentLevel) throw new Error("Invalid level ID provided.");

    const newStudent: Student = { ...formData, level: studentLevel, id: uuidv4(), registrationCode: `AI-${uuidv4().slice(0, 8).toUpperCase()}`, status: 'booked', createdAt: new Date().toISOString() };
    slot.booked++;
    students.push(newStudent);
    return simulateDelay(newStudent);
};


// --- Admin API ---
export const getAllStudents = async (page: number, pageSize: number, searchTerm: string, sortKey: string, sortDirection: string): Promise<{ students: Student[], count: number }> => {
    let filteredStudents = [...students];
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredStudents = filteredStudents.filter(s =>
            `${s.firstname} ${s.surname}`.toLowerCase().includes(lowerSearch) ||
            s.email.toLowerCase().includes(lowerSearch) ||
            s.registrationCode.toLowerCase().includes(lowerSearch)
        );
    }
    if (sortKey) {
        filteredStudents.sort((a, b) => {
            const valA = sortKey === 'level' ? a.level.name : a[sortKey as keyof Student];
            const valB = sortKey === 'level' ? b.level.name : b[sortKey as keyof Student];
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    const count = filteredStudents.length;
    return simulateDelay({ students: filteredStudents.slice((page - 1) * pageSize, page * pageSize), count });
};

export const getDashboardData = async () => ({
    totalRegistered: students.length,
    breakdownByLevel: levels.map(l => ({ name: l.name, value: students.filter(s => s.level.id === l.id).length })),
    todayExpected: students.filter(s => s.intakeDate === new Date().toISOString().split('T')[0]).length,
    checkedIn: students.filter(s => s.intakeDate === new Date().toISOString().split('T')[0] && s.status === 'checked-in').length,
    slotUtilization: appointmentSlots.slice(0,10).map(s => ({ name: `${s.date} ${s.startTime}`, booked: s.booked, capacity: s.capacity })),
});

export const findStudent = async (query: string): Promise<Student | null> => simulateDelay(students.find(s => s.registrationCode.toLowerCase() === query.toLowerCase() || `${s.firstname} ${s.surname}`.toLowerCase().includes(query.toLowerCase())) || null);
export const checkInStudent = async (studentId: string): Promise<Student> => {
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error("Student not found");
    student.status = 'checked-in';
    return simulateDelay(student);
};

// --- Schedule ---
export const getSchedules = async (page: number, pageSize: number): Promise<{ slots: AppointmentSlot[], count: number }> => {
    const sorted = [...appointmentSlots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.startTime.localeCompare(b.startTime));
    return simulateDelay({ slots: sorted.slice((page - 1) * pageSize, page * pageSize), count: sorted.length });
};
export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => simulateDelay(appointmentSlots.find(s => s.id === slotId) || null);
export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>): Promise<AppointmentSlot> => {
    const level = levels.find(l => l.id === slot.levelId);
    if (!level) throw new Error("Level not found");
    const newSlot: AppointmentSlot = { ...slot, id: uuidv4(), booked: 0, level };
    appointmentSlots.push(newSlot);
    return simulateDelay(newSlot);
};
export const updateSchedule = async(slot: Omit<AppointmentSlot, 'level'>): Promise<AppointmentSlot> => {
    const existing = appointmentSlots.find(s => s.id === slot.id);
    if (!existing) throw new Error("Slot not found");
    const level = levels.find(l => l.id === slot.levelId);
    if (!level) throw new Error("Level not found");
    Object.assign(existing, { ...slot, level });
    return simulateDelay(existing);
};
export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    appointmentSlots = appointmentSlots.filter(s => s.id !== slotId);
    return simulateDelay({ success: true });
};

// --- Levels ---
export const getLevels = async(includeInactive = false): Promise<Level[]> => simulateDelay([...levels].sort((a, b) => a.sortOrder - b.sortOrder).filter(l => includeInactive || l.isActive));
export const createLevel = async(level: Omit<Level, 'id'>): Promise<Level> => { const newLevel = { ...level, id: uuidv4() }; levels.push(newLevel); return simulateDelay(newLevel); };
export const updateLevel = async(level: Level): Promise<Level> => { levels = levels.map(l => l.id === level.id ? level : l); return simulateDelay(level); };
export const deleteLevel = async(levelId: string): Promise<{ success: boolean }> => { levels = levels.filter(l => l.id !== levelId); return simulateDelay({ success: true }); };

// --- Programs ---
export const getPrograms = async(): Promise<Program[]> => {
    const programsMap = new Map(programs.map(p => [p.id, { ...p, children: [] }]));
    const nested: Program[] = [];
    for (const program of programsMap.values()) {
        if (program.parentId && programsMap.has(program.parentId)) {
            programsMap.get(program.parentId)?.children?.push(program);
        } else {
            nested.push(program);
        }
    }
    return simulateDelay(nested);
};
export const createProgram = async(p: Omit<Program, 'id'>): Promise<Program> => { const newProg = { ...p, id: uuidv4() }; programs.push(newProg); return simulateDelay(newProg); };
export const updateProgram = async(p: Program): Promise<Program> => { programs = programs.map(prog => prog.id === p.id ? p : prog); return simulateDelay(p); };

// --- Site Content ---
export const getSiteContent = async(): Promise<SiteContent> => simulateDelay(siteContent);
export const updateSiteContent = async(key: keyof SiteContent, value: unknown): Promise<void> => { (siteContent as Record<string, unknown>)[key] = value; return simulateDelay(undefined); }

// --- Users ---
export const getAdminUsers = async (): Promise<AdminUser[]> => simulateDelay(adminUsers);
export const createAdminUser = async(user: Omit<AdminUser, 'id'>): Promise<AdminUser> => { const newUser = { ...user, id: uuidv4() }; adminUsers.push(newUser); return simulateDelay(newUser); };
export const updateAdminUser = async(user: AdminUser): Promise<AdminUser> => { adminUsers = adminUsers.map(u => u.id === user.id ? user : u); return simulateDelay(user); };
export const deleteAdminUser = async(userId: string): Promise<{ success: boolean }> => { adminUsers = adminUsers.filter(u => u.id !== userId); return simulateDelay({ success: true }); };

// --- Settings ---
export const getNotificationSettings = async(): Promise<NotificationSettings> => simulateDelay(notificationSettings);
export const updateNotificationSettings = async(s: NotificationSettings): Promise<NotificationSettings> => { notificationSettings = s; return simulateDelay(s); };
export const getAppSettings = async(): Promise<AppSettings> => simulateDelay(appSettings);
export const updateAppSettings = async(s: AppSettings): Promise<AppSettings> => { appSettings = s; return simulateDelay(s); };