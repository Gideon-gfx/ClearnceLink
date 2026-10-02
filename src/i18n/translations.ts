// Text for each language. English is the source: a key that is missing in another language falls back to English.
// {name} placeholders are filled in by t('key', { name: value }).
import { phrases } from './phrases';

type Dictionary = Record<string, string>;

const en: Dictionary = {
  language: 'Language', defaultTag: 'Default', chooseLanguage: 'Choose language', cancel: 'Cancel',
  signOutTitle: 'Sign out?', signOutMessage: 'You will need to sign in again to use your account.', signOutAction: 'Sign out', signOut: 'Sign Out', signingOut: 'Signing out...',
  navHome: 'Home', navClearances: 'Clearances', navCleared: 'Cleared', navNotifications: 'Notifications', navProfile: 'Profile', navStudents: 'Students', navStaff: 'Staff', navOversight: 'Oversight', navMore: 'More',
  loginStudent: 'Student Login', loginStaff: 'Staff Login', loginInstitution: 'Institution Login',
  loginSubStudent: 'Access your student account.', loginSubStaff: 'Access your staff account.', loginSubInstitution: 'Access your institution dashboard.',
  portalStudent: 'Student Portal', portalStaff: 'Staff Portal', portalInstitution: 'Institution Portal',
  email: 'Email', workEmail: 'Work Email', password: 'Password', enterPassword: 'Enter your password', rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
  loginButton: 'Login', loggingIn: 'Logging in...', noAccount: 'Don’t have an account?', createStudentAccount: 'Create student account', createStaffAccount: 'Create staff account', registerInstitution: 'Register your institution',
  errEnterBoth: 'Enter your email and password.', errEmail: 'Enter a valid email address.',
  goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
  overallProgress: 'Overall Clearance Progress', completedOf: '{done} of {total} completed', completed: 'Completed', pending: 'Pending', actionRequired: 'Action Required', notStarted: 'Not Started',
  activeClearances: 'Active Clearances', viewAll: 'View All', allComplete: 'All your clearances are complete. 🎉',
  pendingReview: 'Pending Review', resubmitted: 'Re-submitted', myClearances: 'My Clearances', addStudent: 'Add Student', importStudents: 'Import Students',
  noClearancesAssigned: 'No clearance responsibilities have been assigned to you yet.',
  adminOverview: 'Here’s your institution overview.', quickActions: 'Quick Actions', statStudents: 'Students', statStaff: 'Staff', statOfficers: 'Active Officers', statCleared: 'Fully Cleared',
  addStaff: 'Add Staff', importStaff: 'Import Staff', assignedRoles: 'Assigned Roles', recentActivity: 'Recent Activity', administrator: 'Institution Administrator',
};

const fr: Dictionary = {
  language: 'Langue', defaultTag: 'Par défaut', chooseLanguage: 'Choisir la langue', cancel: 'Annuler',
  signOutTitle: 'Se déconnecter ?', signOutMessage: 'Vous devrez vous reconnecter pour utiliser votre compte.', signOutAction: 'Se déconnecter', signOut: 'Se déconnecter', signingOut: 'Déconnexion...',
  navHome: 'Accueil', navClearances: 'Autorisations', navCleared: 'Validées', navNotifications: 'Notifications', navProfile: 'Profil', navStudents: 'Étudiants', navStaff: 'Personnel', navOversight: 'Supervision', navMore: 'Plus',
  loginStudent: 'Connexion étudiant', loginStaff: 'Connexion personnel', loginInstitution: 'Connexion établissement',
  loginSubStudent: 'Accédez à votre compte étudiant.', loginSubStaff: 'Accédez à votre compte personnel.', loginSubInstitution: 'Accédez au tableau de bord de votre établissement.',
  portalStudent: 'Portail étudiant', portalStaff: 'Portail du personnel', portalInstitution: 'Portail de l’établissement',
  email: 'E-mail', workEmail: 'E-mail professionnel', password: 'Mot de passe', enterPassword: 'Saisissez votre mot de passe', rememberMe: 'Se souvenir de moi', forgotPassword: 'Mot de passe oublié ?',
  loginButton: 'Se connecter', loggingIn: 'Connexion...', noAccount: 'Vous n’avez pas de compte ?', createStudentAccount: 'Créer un compte étudiant', createStaffAccount: 'Créer un compte personnel', registerInstitution: 'Inscrire votre établissement',
  errEnterBoth: 'Saisissez votre e-mail et votre mot de passe.', errEmail: 'Saisissez une adresse e-mail valide.',
  goodMorning: 'Bonjour', goodAfternoon: 'Bon après-midi', goodEvening: 'Bonsoir',
  overallProgress: 'Progression globale', completedOf: '{done} sur {total} terminées', completed: 'Terminées', pending: 'En attente', actionRequired: 'Action requise', notStarted: 'Non commencées',
  activeClearances: 'Autorisations en cours', viewAll: 'Tout voir', allComplete: 'Toutes vos autorisations sont terminées. 🎉',
  pendingReview: 'En attente de revue', resubmitted: 'Re-soumis', myClearances: 'Mes autorisations', addStudent: 'Ajouter un étudiant', importStudents: 'Importer des étudiants',
  noClearancesAssigned: 'Aucune autorisation ne vous a encore été attribuée.',
  adminOverview: 'Voici l’aperçu de votre établissement.', quickActions: 'Actions rapides', statStudents: 'Étudiants', statStaff: 'Personnel', statOfficers: 'Responsables actifs', statCleared: 'Entièrement validés',
  addStaff: 'Ajouter du personnel', importStaff: 'Importer du personnel', assignedRoles: 'Rôles attribués', recentActivity: 'Activité récente', administrator: 'Administrateur de l’établissement',
};

const es: Dictionary = {
  language: 'Idioma', defaultTag: 'Predeterminado', chooseLanguage: 'Elegir idioma', cancel: 'Cancelar',
  signOutTitle: '¿Cerrar sesión?', signOutMessage: 'Tendrás que iniciar sesión de nuevo para usar tu cuenta.', signOutAction: 'Cerrar sesión', signOut: 'Cerrar sesión', signingOut: 'Cerrando sesión...',
  navHome: 'Inicio', navClearances: 'Autorizaciones', navCleared: 'Aprobadas', navNotifications: 'Notificaciones', navProfile: 'Perfil', navStudents: 'Estudiantes', navStaff: 'Personal', navOversight: 'Supervisión', navMore: 'Más',
  loginStudent: 'Acceso de estudiante', loginStaff: 'Acceso del personal', loginInstitution: 'Acceso de la institución',
  loginSubStudent: 'Accede a tu cuenta de estudiante.', loginSubStaff: 'Accede a tu cuenta del personal.', loginSubInstitution: 'Accede al panel de tu institución.',
  portalStudent: 'Portal del estudiante', portalStaff: 'Portal del personal', portalInstitution: 'Portal de la institución',
  email: 'Correo electrónico', workEmail: 'Correo de trabajo', password: 'Contraseña', enterPassword: 'Introduce tu contraseña', rememberMe: 'Recordarme', forgotPassword: '¿Olvidaste tu contraseña?',
  loginButton: 'Iniciar sesión', loggingIn: 'Iniciando sesión...', noAccount: '¿No tienes una cuenta?', createStudentAccount: 'Crear cuenta de estudiante', createStaffAccount: 'Crear cuenta del personal', registerInstitution: 'Registra tu institución',
  errEnterBoth: 'Introduce tu correo y tu contraseña.', errEmail: 'Introduce un correo electrónico válido.',
  goodMorning: 'Buenos días', goodAfternoon: 'Buenas tardes', goodEvening: 'Buenas noches',
  overallProgress: 'Progreso general', completedOf: '{done} de {total} completadas', completed: 'Completadas', pending: 'Pendientes', actionRequired: 'Acción requerida', notStarted: 'Sin empezar',
  activeClearances: 'Autorizaciones activas', viewAll: 'Ver todo', allComplete: 'Todas tus autorizaciones están completas. 🎉',
  pendingReview: 'Pendientes de revisión', resubmitted: 'Reenviados', myClearances: 'Mis autorizaciones', addStudent: 'Añadir estudiante', importStudents: 'Importar estudiantes',
  noClearancesAssigned: 'Todavía no se te ha asignado ninguna autorización.',
  adminOverview: 'Este es el resumen de tu institución.', quickActions: 'Acciones rápidas', statStudents: 'Estudiantes', statStaff: 'Personal', statOfficers: 'Responsables activos', statCleared: 'Totalmente aprobados',
  addStaff: 'Añadir personal', importStaff: 'Importar personal', assignedRoles: 'Roles asignados', recentActivity: 'Actividad reciente', administrator: 'Administrador de la institución',
};

const it: Dictionary = {
  language: 'Lingua', defaultTag: 'Predefinita', chooseLanguage: 'Scegli la lingua', cancel: 'Annulla',
  signOutTitle: 'Disconnettersi?', signOutMessage: 'Dovrai accedere di nuovo per usare il tuo account.', signOutAction: 'Disconnetti', signOut: 'Esci', signingOut: 'Disconnessione...',
  navHome: 'Home', navClearances: 'Autorizzazioni', navCleared: 'Approvate', navNotifications: 'Notifiche', navProfile: 'Profilo', navStudents: 'Studenti', navStaff: 'Personale', navOversight: 'Supervisione', navMore: 'Altro',
  loginStudent: 'Accesso studente', loginStaff: 'Accesso personale', loginInstitution: 'Accesso istituto',
  loginSubStudent: 'Accedi al tuo account studente.', loginSubStaff: 'Accedi al tuo account del personale.', loginSubInstitution: 'Accedi alla dashboard del tuo istituto.',
  portalStudent: 'Portale studenti', portalStaff: 'Portale del personale', portalInstitution: 'Portale dell’istituto',
  email: 'E-mail', workEmail: 'E-mail di lavoro', password: 'Password', enterPassword: 'Inserisci la tua password', rememberMe: 'Ricordami', forgotPassword: 'Password dimenticata?',
  loginButton: 'Accedi', loggingIn: 'Accesso in corso...', noAccount: 'Non hai un account?', createStudentAccount: 'Crea un account studente', createStaffAccount: 'Crea un account del personale', registerInstitution: 'Registra il tuo istituto',
  errEnterBoth: 'Inserisci e-mail e password.', errEmail: 'Inserisci un indirizzo e-mail valido.',
  goodMorning: 'Buongiorno', goodAfternoon: 'Buon pomeriggio', goodEvening: 'Buonasera',
  overallProgress: 'Avanzamento complessivo', completedOf: '{done} di {total} completate', completed: 'Completate', pending: 'In attesa', actionRequired: 'Azione richiesta', notStarted: 'Non iniziate',
  activeClearances: 'Autorizzazioni attive', viewAll: 'Vedi tutto', allComplete: 'Tutte le tue autorizzazioni sono complete. 🎉',
  pendingReview: 'In attesa di revisione', resubmitted: 'Reinviati', myClearances: 'Le mie autorizzazioni', addStudent: 'Aggiungi studente', importStudents: 'Importa studenti',
  noClearancesAssigned: 'Non ti è ancora stata assegnata nessuna autorizzazione.',
  adminOverview: 'Ecco la panoramica del tuo istituto.', quickActions: 'Azioni rapide', statStudents: 'Studenti', statStaff: 'Personale', statOfficers: 'Responsabili attivi', statCleared: 'Completamente approvati',
  addStaff: 'Aggiungi personale', importStaff: 'Importa personale', assignedRoles: 'Ruoli assegnati', recentActivity: 'Attività recente', administrator: 'Amministratore dell’istituto',
};

const pt: Dictionary = {
  language: 'Idioma', defaultTag: 'Padrão', chooseLanguage: 'Escolher idioma', cancel: 'Cancelar',
  signOutTitle: 'Sair?', signOutMessage: 'Você precisará entrar novamente para usar sua conta.', signOutAction: 'Sair', signOut: 'Sair', signingOut: 'Saindo...',
  navHome: 'Início', navClearances: 'Autorizações', navCleared: 'Aprovadas', navNotifications: 'Notificações', navProfile: 'Perfil', navStudents: 'Estudantes', navStaff: 'Equipe', navOversight: 'Supervisão', navMore: 'Mais',
  loginStudent: 'Login do estudante', loginStaff: 'Login da equipe', loginInstitution: 'Login da instituição',
  loginSubStudent: 'Acesse sua conta de estudante.', loginSubStaff: 'Acesse sua conta da equipe.', loginSubInstitution: 'Acesse o painel da sua instituição.',
  portalStudent: 'Portal do estudante', portalStaff: 'Portal da equipe', portalInstitution: 'Portal da instituição',
  email: 'E-mail', workEmail: 'E-mail profissional', password: 'Senha', enterPassword: 'Digite sua senha', rememberMe: 'Lembrar de mim', forgotPassword: 'Esqueceu a senha?',
  loginButton: 'Entrar', loggingIn: 'Entrando...', noAccount: 'Não tem uma conta?', createStudentAccount: 'Criar conta de estudante', createStaffAccount: 'Criar conta da equipe', registerInstitution: 'Cadastre sua instituição',
  errEnterBoth: 'Digite seu e-mail e sua senha.', errEmail: 'Digite um e-mail válido.',
  goodMorning: 'Bom dia', goodAfternoon: 'Boa tarde', goodEvening: 'Boa noite',
  overallProgress: 'Progresso geral', completedOf: '{done} de {total} concluídas', completed: 'Concluídas', pending: 'Pendentes', actionRequired: 'Ação necessária', notStarted: 'Não iniciadas',
  activeClearances: 'Autorizações ativas', viewAll: 'Ver tudo', allComplete: 'Todas as suas autorizações estão concluídas. 🎉',
  pendingReview: 'Aguardando revisão', resubmitted: 'Reenviados', myClearances: 'Minhas autorizações', addStudent: 'Adicionar estudante', importStudents: 'Importar estudantes',
  noClearancesAssigned: 'Nenhuma autorização foi atribuída a você ainda.',
  adminOverview: 'Veja o resumo da sua instituição.', quickActions: 'Ações rápidas', statStudents: 'Estudantes', statStaff: 'Equipe', statOfficers: 'Responsáveis ativos', statCleared: 'Totalmente aprovados',
  addStaff: 'Adicionar equipe', importStaff: 'Importar equipe', assignedRoles: 'Funções atribuídas', recentActivity: 'Atividade recente', administrator: 'Administrador da instituição',
};

const de: Dictionary = {
  language: 'Sprache', defaultTag: 'Standard', chooseLanguage: 'Sprache wählen', cancel: 'Abbrechen',
  signOutTitle: 'Abmelden?', signOutMessage: 'Sie müssen sich erneut anmelden, um Ihr Konto zu nutzen.', signOutAction: 'Abmelden', signOut: 'Abmelden', signingOut: 'Abmeldung...',
  navHome: 'Start', navClearances: 'Freigaben', navCleared: 'Freigegeben', navNotifications: 'Mitteilungen', navProfile: 'Profil', navStudents: 'Studierende', navStaff: 'Personal', navOversight: 'Aufsicht', navMore: 'Mehr',
  loginStudent: 'Anmeldung für Studierende', loginStaff: 'Anmeldung für Personal', loginInstitution: 'Anmeldung für Einrichtungen',
  loginSubStudent: 'Greifen Sie auf Ihr Studierendenkonto zu.', loginSubStaff: 'Greifen Sie auf Ihr Personalkonto zu.', loginSubInstitution: 'Greifen Sie auf das Dashboard Ihrer Einrichtung zu.',
  portalStudent: 'Studierendenportal', portalStaff: 'Personalportal', portalInstitution: 'Einrichtungsportal',
  email: 'E-Mail', workEmail: 'Geschäftliche E-Mail', password: 'Passwort', enterPassword: 'Passwort eingeben', rememberMe: 'Angemeldet bleiben', forgotPassword: 'Passwort vergessen?',
  loginButton: 'Anmelden', loggingIn: 'Anmeldung...', noAccount: 'Noch kein Konto?', createStudentAccount: 'Studierendenkonto erstellen', createStaffAccount: 'Personalkonto erstellen', registerInstitution: 'Einrichtung registrieren',
  errEnterBoth: 'Geben Sie Ihre E-Mail und Ihr Passwort ein.', errEmail: 'Geben Sie eine gültige E-Mail-Adresse ein.',
  goodMorning: 'Guten Morgen', goodAfternoon: 'Guten Tag', goodEvening: 'Guten Abend',
  overallProgress: 'Gesamtfortschritt', completedOf: '{done} von {total} abgeschlossen', completed: 'Abgeschlossen', pending: 'Ausstehend', actionRequired: 'Aktion erforderlich', notStarted: 'Nicht begonnen',
  activeClearances: 'Aktive Freigaben', viewAll: 'Alle anzeigen', allComplete: 'Alle Ihre Freigaben sind abgeschlossen. 🎉',
  pendingReview: 'Zur Prüfung', resubmitted: 'Erneut eingereicht', myClearances: 'Meine Freigaben', addStudent: 'Studierende hinzufügen', importStudents: 'Studierende importieren',
  noClearancesAssigned: 'Ihnen wurde noch keine Freigabe zugewiesen.',
  adminOverview: 'Hier ist die Übersicht Ihrer Einrichtung.', quickActions: 'Schnellaktionen', statStudents: 'Studierende', statStaff: 'Personal', statOfficers: 'Aktive Verantwortliche', statCleared: 'Vollständig freigegeben',
  addStaff: 'Personal hinzufügen', importStaff: 'Personal importieren', assignedRoles: 'Zugewiesene Rollen', recentActivity: 'Letzte Aktivität', administrator: 'Administrator der Einrichtung',
};

const zh: Dictionary = {
  language: '语言', defaultTag: '默认', chooseLanguage: '选择语言', cancel: '取消',
  signOutTitle: '退出登录？', signOutMessage: '您需要重新登录才能使用您的账户。', signOutAction: '退出登录', signOut: '退出登录', signingOut: '正在退出...',
  navHome: '首页', navClearances: '审批', navCleared: '已通过', navNotifications: '通知', navProfile: '我的', navStudents: '学生', navStaff: '员工', navOversight: '监督', navMore: '更多',
  loginStudent: '学生登录', loginStaff: '员工登录', loginInstitution: '机构登录',
  loginSubStudent: '登录您的学生账户。', loginSubStaff: '登录您的员工账户。', loginSubInstitution: '登录您的机构管理面板。',
  portalStudent: '学生门户', portalStaff: '员工门户', portalInstitution: '机构门户',
  email: '电子邮箱', workEmail: '工作邮箱', password: '密码', enterPassword: '请输入密码', rememberMe: '记住我', forgotPassword: '忘记密码？',
  loginButton: '登录', loggingIn: '登录中...', noAccount: '还没有账户？', createStudentAccount: '创建学生账户', createStaffAccount: '创建员工账户', registerInstitution: '注册您的机构',
  errEnterBoth: '请输入邮箱和密码。', errEmail: '请输入有效的电子邮箱。',
  goodMorning: '早上好', goodAfternoon: '下午好', goodEvening: '晚上好',
  overallProgress: '总体进度', completedOf: '已完成 {done}/{total}', completed: '已完成', pending: '待处理', actionRequired: '需要处理', notStarted: '未开始',
  activeClearances: '进行中的审批', viewAll: '查看全部', allComplete: '您的所有审批均已完成。🎉',
  pendingReview: '待审核', resubmitted: '已重新提交', myClearances: '我的审批', addStudent: '添加学生', importStudents: '导入学生',
  noClearancesAssigned: '您还没有被分配任何审批。',
  adminOverview: '这是您机构的概览。', quickActions: '快捷操作', statStudents: '学生', statStaff: '员工', statOfficers: '在任负责人', statCleared: '全部通过',
  addStaff: '添加员工', importStaff: '导入员工', assignedRoles: '已分配角色', recentActivity: '最近动态', administrator: '机构管理员',
};

const hi: Dictionary = {
  language: 'भाषा', defaultTag: 'डिफ़ॉल्ट', chooseLanguage: 'भाषा चुनें', cancel: 'रद्द करें',
  signOutTitle: 'साइन आउट करें?', signOutMessage: 'अपना खाता इस्तेमाल करने के लिए आपको फिर से साइन इन करना होगा।', signOutAction: 'साइन आउट', signOut: 'साइन आउट', signingOut: 'साइन आउट हो रहा है...',
  navHome: 'होम', navClearances: 'क्लियरेंस', navCleared: 'स्वीकृत', navNotifications: 'सूचनाएँ', navProfile: 'प्रोफ़ाइल', navStudents: 'छात्र', navStaff: 'स्टाफ़', navOversight: 'निगरानी', navMore: 'और',
  loginStudent: 'छात्र लॉगिन', loginStaff: 'स्टाफ़ लॉगिन', loginInstitution: 'संस्थान लॉगिन',
  loginSubStudent: 'अपने छात्र खाते में प्रवेश करें।', loginSubStaff: 'अपने स्टाफ़ खाते में प्रवेश करें।', loginSubInstitution: 'अपने संस्थान के डैशबोर्ड में प्रवेश करें।',
  portalStudent: 'छात्र पोर्टल', portalStaff: 'स्टाफ़ पोर्टल', portalInstitution: 'संस्थान पोर्टल',
  email: 'ईमेल', workEmail: 'कार्य ईमेल', password: 'पासवर्ड', enterPassword: 'अपना पासवर्ड दर्ज करें', rememberMe: 'मुझे याद रखें', forgotPassword: 'पासवर्ड भूल गए?',
  loginButton: 'लॉगिन', loggingIn: 'लॉगिन हो रहा है...', noAccount: 'खाता नहीं है?', createStudentAccount: 'छात्र खाता बनाएँ', createStaffAccount: 'स्टाफ़ खाता बनाएँ', registerInstitution: 'अपना संस्थान पंजीकृत करें',
  errEnterBoth: 'अपना ईमेल और पासवर्ड दर्ज करें।', errEmail: 'मान्य ईमेल पता दर्ज करें।',
  goodMorning: 'सुप्रभात', goodAfternoon: 'शुभ दोपहर', goodEvening: 'शुभ संध्या',
  overallProgress: 'कुल प्रगति', completedOf: '{total} में से {done} पूर्ण', completed: 'पूर्ण', pending: 'लंबित', actionRequired: 'कार्रवाई आवश्यक', notStarted: 'शुरू नहीं हुआ',
  activeClearances: 'सक्रिय क्लियरेंस', viewAll: 'सभी देखें', allComplete: 'आपके सभी क्लियरेंस पूरे हो गए हैं। 🎉',
  pendingReview: 'समीक्षा लंबित', resubmitted: 'दोबारा जमा', myClearances: 'मेरे क्लियरेंस', addStudent: 'छात्र जोड़ें', importStudents: 'छात्र आयात करें',
  noClearancesAssigned: 'अभी तक आपको कोई क्लियरेंस नहीं सौंपा गया है।',
  adminOverview: 'यह आपके संस्थान का अवलोकन है।', quickActions: 'त्वरित कार्य', statStudents: 'छात्र', statStaff: 'स्टाफ़', statOfficers: 'सक्रिय अधिकारी', statCleared: 'पूर्ण रूप से स्वीकृत',
  addStaff: 'स्टाफ़ जोड़ें', importStaff: 'स्टाफ़ आयात करें', assignedRoles: 'सौंपी गई भूमिकाएँ', recentActivity: 'हाल की गतिविधि', administrator: 'संस्थान प्रशासक',
};

// Each language: its phrases (keyed by the English text on screen) plus the short named keys above.
const withPhrases = (code: string, named: Dictionary): Dictionary => ({ ...(phrases[code] || {}), ...named });
export const translations: Record<string, Dictionary> = { en, fr: withPhrases('fr', fr), es: withPhrases('es', es), it: withPhrases('it', it), pt: withPhrases('pt', pt), de: withPhrases('de', de), zh: withPhrases('zh', zh), hi: withPhrases('hi', hi) };
